import client from './client';
import { toBookingError } from './apiError';
import type { Patient } from './patients';

/**
 * Finding a patient in order to book them - booking contract 5.9, step 1.
 *
 * This is deliberately not `patientsApi.search`. There are **three** live
 * patient-search surfaces in this system, and on 10. 9. 2026 the `app` lane
 * confirmed they are not equivalent:
 *
 *   - `GET /api/v1/patients` - the registry route. Goes through the registry's
 *     authorisation with an organisation and clinic scope, and returns the
 *     `Revision` booking needs. Takes `firstName`/`lastName`, not free text.
 *   - `GET /api/patients?query=` - what 5.9 names, and what this file calls.
 *   - `GET /api/patients/search?q=` - the older surface `patientsApi.search`
 *     uses, and what three screens outside this lane still call.
 *
 * The lane keeps its own call rather than changing the shared one, because
 * changing `patientsApi.search` would move `UniversalSearch`, the cashier and
 * the GDPR screen off a path nobody asked to move them off.
 *
 * Two things about this search are known and neither is fixed here:
 *
 *   - **It distinguishes diacritics.** `Černá` finds her, `Cerna` finds
 *     nobody, while case is handled. Measured against the running registry.
 *     A receptionist on the phone types without diacritics, finds nothing, and
 *     creates a duplicate - which is the exact outcome 5.9's "search first"
 *     rule exists to prevent. The `app` lane has it; the dialog says so out
 *     loud in the meantime rather than letting the silence do the damage.
 *   - **This route carries no scope check** beyond requiring a login, unlike
 *     the registry route. Reported by `app` on 10. 9. 2026 as theirs to fix.
 *     Recorded here so the next reader knows the choice was made with it in
 *     view rather than in ignorance of it.
 */

function extractItems(data: unknown): Patient[] {
  if (Array.isArray(data)) return data as Patient[];
  const box = data as { items?: Patient[]; data?: { items?: Patient[] } } | null;
  if (box?.items) return box.items;
  if (box?.data?.items) return box.data.items;
  return [];
}

export async function searchPatientsForBooking(query: string): Promise<Patient[]> {
  try {
    const res = await client.get('/api/patients', { params: { query } });
    return extractItems(res.data);
  } catch (error) {
    throw toBookingError(error);
  }
}

export default searchPatientsForBooking;
