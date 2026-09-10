import client from './client';
import { toBookingError } from './apiError';
import { patientRegistryApi } from './patientRegistry';

/**
 * Finding a patient in order to book them - booking contract 5.9 step 1, as
 * v33 describes it.
 *
 * Two live surfaces answer different questions, and the difference is written
 * down here rather than one of them being picked quietly:
 *
 *   - **the registry** (`patientRegistryApi.searchPatients`, `GET
 *     /api/v1/patients`) - takes `firstName` / `lastName` / `dateOfBirth`, and
 *     refuses anything else with `400` instead of ignoring it. This answers
 *     "is this person registered at this clinic".
 *   - **`GET /api/patients?query=`** - free text over every row, including
 *     people the registry cannot see.
 *
 * Both matter. On the gate database most patients are rows from an older seed
 * that were never registered: they exist and can be booked, and the registry
 * does not know them. A dialog that asked only the registry would report
 * "nobody" about people who are plainly there; one that asked only the
 * free-text surface would never notice a record is unregistered - which is a
 * thing to put right, not a thing to book on top of and forget.
 *
 * **Both distinguish diacritics.** `Novák` finds him, `Novak` finds nobody,
 * while case is handled either way. A receptionist on the phone types without
 * diacritics, so an empty result on this screen never says "this person does
 * not exist". It cannot know that.
 *
 * The registry row was measured, not assumed - registered live on 10. 9. 2026
 * and read off the wire:
 *
 *     [{ "patientId": "e5aa…", "fullName": "Overovaci Pacient",
 *        "dateOfBirth": "1985-03-14", "sex": "Male",
 *        "status": "Active", "revision": 1 }]
 *
 * A bare array, six fields, and **no `firstName` or `lastName`** - the name
 * comes back joined even though the search takes it in halves.
 */

/** What this screen needs of a patient, from either surface. */
export interface PatientOption {
  id: string;
  name: string;
  dateOfBirth: string | null;
  /** False when the row exists but the registry does not know it (v33). */
  registered: boolean;
}

export interface RegistryQuery {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

/**
 * The supported search: registered patients only.
 *
 * It goes through `patientRegistryApi`, whose `PatientSearchResult` is the
 * repository's own typed statement of this row. An earlier version of this file
 * guessed the field names defensively instead - `firstName ?? givenName`,
 * `lastName ?? familyName ?? surname` - which happened to work because it also
 * read `fullName`, but was guesswork standing next to a declared type nobody
 * had looked for.
 */
export async function searchRegistry(query: RegistryQuery): Promise<PatientOption[]> {
  const criteria = {
    firstName: query.firstName?.trim() || undefined,
    lastName: query.lastName?.trim() || undefined,
    dateOfBirth: query.dateOfBirth?.trim() || undefined,
  };

  /* The registry answers `400` to a query with no criterion, and is right to. */
  if (!criteria.firstName && !criteria.lastName && !criteria.dateOfBirth) {
    return [];
  }

  const rows = await patientRegistryApi.searchPatients(criteria);
  return rows.map((r) => ({
    id: r.patientId,
    name: r.fullName,
    dateOfBirth: r.dateOfBirth ?? null,
    registered: true,
  }));
}

/**
 * The wider search: every row, registered or not.
 *
 * Offered only after the registry found nothing, and its hits are labelled. A
 * record here that the registry does not know is a record to put right -
 * booking on top of it is allowed, creating a second one is not.
 *
 * This surface has no typed client of its own because it returns whatever
 * `core.patients` holds, so the fields are read one at a time and a row
 * survives any of them being absent.
 */
export async function searchAllPatients(query: string): Promise<PatientOption[]> {
  if (!query.trim()) return [];

  try {
    const res = await client.get('/api/patients', {
      params: { query: query.trim() },
    });
    return extractItems(res.data).map(toOption);
  } catch (error) {
    throw toBookingError(error);
  }
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const box = data as { items?: unknown[]; data?: { items?: unknown[] } } | null;
  if (Array.isArray(box?.items)) return box.items;
  if (Array.isArray(box?.data?.items)) return box.data.items;
  return [];
}

function toOption(row: unknown): PatientOption {
  const r = row as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof r[key] === 'string' ? (r[key] as string) : undefined;

  const joined = [str('lastName'), str('firstName')].filter(Boolean).join(' ');

  return {
    id: str('id') ?? str('patientId') ?? '',
    name: str('fullName') ?? joined ?? '',
    dateOfBirth: str('dateOfBirth') ?? null,
    registered: false,
  };
}
