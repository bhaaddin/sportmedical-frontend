/*
 * RÚIAN address lookup for the public questionnaire - the anonymous half.
 *
 * There are two address surfaces and they are not interchangeable:
 *
 *     /api/address-lookup/*    anonymous      q, limit          ← this file
 *     /api/v1/addresses/*      needs a token  query, maximumResults
 *
 * The patient filling the questionnaire from home has no account, so the
 * questionnaire uses this one. Reception, working under a login, uses the
 * authenticated one through `patientRegistry` - where the permission check
 * actually happens. Same catalogue, deliberately two doors.
 *
 * Both existed before either lane knew it: one message said the anonymous path
 * "returns 400", the other that the authenticated one "returns 401", and both
 * were right about their own caller and wrong about the other's. The parameter
 * names are the whole difference, which is why they are written above.
 *
 * The catalogue is the real ČÚZK dataset - 3 021 203 address points as of
 * 11. 9. 2026, not the 40 samples it held the day before.
 */
import axios from 'axios';

/** No auth interceptor: these two endpoints must be reachable without a token. */
const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** A street within a municipality part - what the first box searches. */
export interface AddressLocality {
  streetCode: number;
  streetName: string;
  municipalityPartCode: number;
  municipalityPartName: string;
  municipalityCode: number;
  municipalityName: string;
  /** `Americká — Vinohrady, Praha` - ready to show, built by the server. */
  displayValue: string;
}

/** One numbered building. `addressPointCode` is the only part the API wants back. */
export interface AddressPoint {
  addressPointCode: number;
  streetName: string;
  buildingNumber: number;
  orientationNumber: number | null;
  municipalityPartName: string;
  municipalityName: string;
  postalCode: string;
  /** `Americká 118/38, 120 00 Praha`. */
  formattedAddress: string;
}

/**
 * Streets, and the town they are in. `q` may carry both - "Americka Vinohrady"
 * answers with exactly one row where "Americka" alone answers with twenty-five
 * Americkás in alphabetical order of municipality and no Prague among them.
 *
 * With 3 021 203 points in the catalogue that is the difference between a
 * patient finding their street and giving up, so the limit is the server's own
 * maximum - asking for 100 still returns 25 - and the box says out loud that
 * the town may be typed too.
 */
export async function searchLocalities(
  q: string,
  limit = 25,
): Promise<AddressLocality[]> {
  if (q.trim().length < 2) return [];
  const res = await publicClient.get<AddressLocality[]>(
    '/api/address-lookup/localities',
    { params: { q: q.trim(), limit } },
  );
  return res.data ?? [];
}

/**
 * Buildings on one street. `q` is the house number and is **required** -
 * an empty one answers 400, so an empty box asks nothing rather than asking
 * wrongly.
 */
export async function searchPoints(
  streetCode: number,
  partCode: number,
  q: string,
  limit = 10,
): Promise<AddressPoint[]> {
  if (q.trim().length === 0) return [];
  const res = await publicClient.get<AddressPoint[]>(
    '/api/address-lookup/points',
    { params: { streetCode, partCode, q: q.trim(), limit } },
  );
  return res.data ?? [];
}
