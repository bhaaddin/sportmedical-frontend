import axios from 'axios';
import type { EmailInspection } from './patientRegistry';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Deliberately NOT the shared `client`: that one attaches a bearer token and
 * sends a 401 to the staff login screen. A patient filling in a questionnaire
 * has no token and must never be bounced to a login page.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Whether an e-mail address is one, asked without signing in.
 *
 * `POST /api/public/contact-check/email` — app's anonymous twin of
 * `/api/v1/patients/email/inspect`, on the SAME canonicaliser rather than a
 * copy of it, and answering in the same shape. Measured with no
 * `Authorization` header at all on 15. 9. 2026.
 *
 * It exists because the questionnaire held a third hand-written definition of
 * an e-mail address, and it disagreed with the server the same way the staff
 * screen's did: `jan@localhost` is stored by the server and was refused by the
 * form, because the form insisted on a dot in the domain.
 *
 * It can say whether an address is WELL FORMED and nothing else. Whether the
 * clinic already knows it is not askable here, and should not be: that would
 * turn a public box into a way of testing who is a patient.
 *
 * Rate limited to 60 a minute per address — a field somebody is typing in,
 * not a submission.
 */
export async function checkPublicEmail(value: string): Promise<EmailInspection> {
  const response = await publicClient.post<EmailInspection>(
    '/api/public/contact-check/email',
    { value },
  );
  return response.data;
}
