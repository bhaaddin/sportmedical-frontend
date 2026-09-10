import client from './client';
import { toBookingError } from './apiError';
import type { Patient } from './patients';

/**
 * Finding a patient in order to book them - booking contract 5.9 step 1, as
 * v33 describes it.
 *
 * There are two live surfaces and they answer different questions. This matters
 * more than it looks, so both are here with the difference written down rather
 * than one of them chosen quietly.
 *
 *   - **`GET /api/v1/patients`** - the registry. Takes `firstName`,
 *     `lastName`, `dateOfBirth`; **rejects anything else with `400`** rather
 *     than ignoring it, which is the right way round. This is the supported
 *     search and the one that answers "is this person registered here".
 *   - **`GET /api/patients?query=`** - free text over `core.patients`, and it
 *     returns **every** row, including people the registry cannot see.
 *
 * On the gate database today the registry finds nobody at all: all five
 * patients are rows from an older seed that were never registered. They exist
 * and can be booked; the registry simply does not know them. So a dialog that
 * searched only the registry would report "nobody" about people who are
 * plainly there, and a dialog that searched only the free-text surface would
 * never notice that a record is unregistered - which is a thing to fix, not a
 * thing to book on top of.
 *
 * **Both surfaces distinguish diacritics.** `Novák` finds him, `Novak` finds
 * nobody, while case is handled. A receptionist on the phone types without
 * diacritics. That is why an empty result on this screen never says "this
 * person does not exist" - it cannot know that, and saying it is how the
 * second Jan Novák gets created.
 *
 * Measured against the running API on 10. 9. 2026, not read from the contract:
 *
 *   /api/v1/patients                 -> 400, "Požadavek obsahuje neplatné údaje."
 *   /api/v1/patients?lastName=Novák  -> 200, zero rows
 *   /api/v1/patients?query=Nov       -> 400, unknown parameter refused
 *   /api/patients?query=Nov          -> 200, Jan Novák
 *   /api/patients?query=Novak        -> 200, zero rows
 */

/** Rows arrive in more than one wrapper depending on the surface. */
function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const box = data as { items?: unknown[]; data?: { items?: unknown[] } } | null;
  if (Array.isArray(box?.items)) return box.items;
  if (Array.isArray(box?.data?.items)) return box.data.items;
  return [];
}

/**
 * The registry's rows, read defensively.
 *
 * The gate database has no registered patient, so the success shape of
 * `/api/v1/patients` could not be observed - only its `400` and its empty
 * `200`. Rather than assume field names that have never been seen, every field
 * is taken if present and the row still renders without them. When the `app`
 * lane has a registered patient to look at, this is the function to check
 * against a real answer.
 */
function toPatient(row: unknown): Patient {
  const r = row as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof r[key] === 'string' ? (r[key] as string) : undefined;

  return {
    id: str('id') ?? str('patientId') ?? '',
    firstName: str('firstName') ?? str('givenName') ?? '',
    lastName: str('lastName') ?? str('familyName') ?? str('surname') ?? '',
    dateOfBirth: str('dateOfBirth') ?? str('birthDate') ?? '',
    sex: str('sex') ?? '',
    fullName: str('fullName') ?? str('displayName'),
    email: str('email'),
    phone: str('phone') ?? str('phoneNumber'),
    createdAtUtc: str('createdAtUtc') ?? '',
    updatedAtUtc: str('updatedAtUtc') ?? '',
  };
}

export interface RegistryQuery {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

/** The supported search: registered patients only. Needs at least one field. */
export async function searchRegistry(query: RegistryQuery): Promise<Patient[]> {
  const params: Record<string, string> = {};
  if (query.firstName?.trim()) params.firstName = query.firstName.trim();
  if (query.lastName?.trim()) params.lastName = query.lastName.trim();
  if (query.dateOfBirth?.trim()) params.dateOfBirth = query.dateOfBirth.trim();

  /* The registry answers `400` to an empty query, and it is right to. */
  if (Object.keys(params).length === 0) return [];

  try {
    const res = await client.get('/api/v1/patients', { params });
    return extractItems(res.data).map(toPatient);
  } catch (error) {
    throw toBookingError(error);
  }
}

/**
 * The wider search: every row, registered or not.
 *
 * Offered only after the registry found nothing, and its hits are labelled.
 * A record here that the registry does not know is a record to put right -
 * booking on top of it is allowed, creating a second one is not.
 */
export async function searchAllPatients(query: string): Promise<Patient[]> {
  if (!query.trim()) return [];
  try {
    const res = await client.get('/api/patients', {
      params: { query: query.trim() },
    });
    return extractItems(res.data).map(toPatient);
  } catch (error) {
    throw toBookingError(error);
  }
}
