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

/**
 * A street within a municipality part - what the first box searches.
 *
 * `streetCode` and `streetName` are NULL for a village that has no streets at
 * all: `Bohuslavice — Bohuslavice` comes back with both null and its buildings
 * are numbered off the municipality part alone. They were typed non-nullable
 * here until 15. 9. 2026, and `searchPoints` took the code as a required
 * argument, so no address outside a town could be found through this module -
 * not in registration and not in the public questionnaire. Measured against the
 * live catalogue, not inferred.
 */
export interface AddressLocality {
  streetCode: number | null;
  streetName: string | null;
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
  /** Null in a village - the building is numbered off the municipality part. */
  streetName: string | null;
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
  streetCode: number | null,
  partCode: number,
  q: string,
  limit = 25,
): Promise<AddressPoint[]> {
  if (q.trim().length === 0) return [];
  const res = await publicClient.get<AddressPoint[]>(
    '/api/address-lookup/points',
    {
      /* `partCode` is required and `streetCode` is not - omitted, the server
         answers with the buildings of the whole municipality part, which is
         the only way a village address can be found. Sending `null` would be
         sent as the string "null" by axios, so it is dropped instead. */
      params: {
        partCode,
        q: q.trim(),
        limit,
        ...(streetCode === null ? {} : { streetCode }),
      },
    },
  );
  return res.data ?? [];
}

/**
 * Whether the catalogue is there at all, and how old it is.
 *
 * Registration cannot be completed without it: the request carries a RÚIAN
 * point code and the Domain refuses anything but a positive one, so a screen
 * that lets somebody fill in thirty fields and then fails at the save is a
 * screen that wasted their time. This is what lets it say so first.
 */
export interface AddressCatalogueStatus {
  loaded: boolean;
  addressPointCount: number;
  datasetDate?: string | null;
}

export async function catalogueStatus(): Promise<AddressCatalogueStatus> {
  const res = await publicClient.get<AddressCatalogueStatus>('/api/address-lookup/status');
  return res.data;
}
