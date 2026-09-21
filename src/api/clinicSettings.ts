import axios from 'axios';
import { client } from './client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/* ── What the public may read ─────────────────────────────────────── */

/**
 * The clinic as a patient sees it.
 *
 * Every field may be empty, and empty means the owner has not filled it in —
 * never a placeholder. A page that has no telephone number leaves the sentence
 * out; it does not print one that belongs to nobody.
 */
export interface PublicClinic {
  name: string;
  email: string;
  phone: string;
  address: string;
  bookingEnabled: boolean;
}

/**
 * Deliberately NOT the shared `client`: that one attaches a bearer token and
 * sends a 401 to the staff login screen, and everybody reading this is
 * anonymous.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Never throws. A public page that cannot reach this still has to render: the
 * clinic's telephone number is a nice-to-have on a booking form, and losing the
 * whole screen over it would be the wrong trade.
 */
export const readPublicClinic = async (): Promise<PublicClinic> => {
  try {
    const { data } = await publicClient.get<PublicClinic>('/api/public/clinic');

    return {
      name: data.name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      address: data.address ?? '',
      bookingEnabled: data.bookingEnabled !== false,
    };
  } catch {
    return { name: '', email: '', phone: '', address: '', bookingEnabled: true };
  }
};

/* ── What an administrator may write ──────────────────────────────── */

interface SettingRow {
  key: string;
  value: string;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Reads settings by key.
 *
 * Absent keys simply do not come back, which is how "never set" is told apart
 * from "set to empty" — the screen shows a blank field either way, but the save
 * does not invent a row for something nobody has touched.
 */
export const readSettings = async (keys: string[]): Promise<Record<string, string>> => {
  const { data } = await client.get<ApiResult<SettingRow[]>>('/api/settings');

  const wanted = new Set(keys);
  const found: Record<string, string> = {};

  for (const row of data.data ?? []) {
    if (wanted.has(row.key)) found[row.key] = row.value ?? '';
  }

  return found;
};

/**
 * Writes them in one request.
 *
 * One call rather than one per field: a half-saved settings screen is a clinic
 * with a new telephone number and its old address.
 */
export const saveSettings = async (values: Record<string, string>): Promise<void> => {
  // The endpoint takes a plain key/value map, not a list of rows.
  await client.put('/api/settings/bulk', values);
};

/** The keys the public-details screen owns. */
export const PUBLIC_CLINIC_KEYS = {
  name: 'pub.siteName',
  email: 'pub.contactEmail',
  phone: 'pub.contactPhone',
  address: 'pub.contactAddress',
  bookingEnabled: 'pub.bookingEnabled',
} as const;
