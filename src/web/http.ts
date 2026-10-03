import axios from 'axios';

/**
 * The public site's HTTP client. Deliberately NOT the staff `client` (src/api/client.ts):
 * that one attaches a bearer token, imports the live-connection service and sends a 401 to
 * the staff login. A visitor of /web has no token, and the public bundle must not pull the
 * staff application in.
 */
export const API_BASE: string = import.meta.env?.VITE_API_BASE_URL ?? '';

export const webHttp = axios.create({
  baseURL: API_BASE,
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
});

/** The shared `{ success, data }` envelope, when the server sends it. */
export function unwrapEnvelope(raw: unknown): unknown {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'success' in raw && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}
