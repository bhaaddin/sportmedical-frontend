import axios from 'axios';
import type { EmailInspection, PhoneInspection } from './patientRegistry';

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

/**
 * What a telephone number is, asked without signing in.
 *
 * `POST /api/public/contact-check/phone` — the anonymous twin of
 * `/api/v1/patients/phone/inspect`, on the same libphonenumber. Measured with
 * no `Authorization` header on 15. 9. 2026:
 *
 *   +36301234567  asked as CZ  →  detectedRegionCode HU, isValid true
 *   777777777     asked as CZ  →  national "777 777 777", valid for CZ
 *
 * The questionnaire used to do this itself — five dial prefixes written out by
 * hand and an E.164 shape check — and it did not only JUDGE the number, it
 * BUILT the value that was submitted: `777777777` + CZ became `+420777777777`
 * by string concatenation. That is a fourth copy of something the server owns,
 * and the owner's instruction was plain: "nechcem mat dva system i u mojej
 * rezervacie a v dotazniku iny … rovnaka logika a premakanost u oboch uplne
 * rovnako."
 *
 * Send the number exactly as typed — spaces, brackets and all. Cleaning it
 * here would be the same mistake in a smaller place.
 */
export async function checkPublicPhone(
  value: string,
  regionCode: string,
): Promise<PhoneInspection> {
  const response = await publicClient.post<PhoneInspection>(
    '/api/public/contact-check/phone',
    { value, regionCode },
  );
  return response.data;
}

export interface PublicPhoneRegion {
  code: string;
  /** `CZ (+420)` — the server's own wording, never rebuilt here. */
  displayValue: string;
}

/**
 * Every dialling code the registry knows, without signing in.
 *
 * `GET /api/public/contact-check/phone-regions` — measured: 245 entries,
 * no token, the same source as the staff `options.phoneRegions` and as the
 * check itself. The prefix in `displayValue` is GENERATED from the numbering
 * plan rather than typed out, so no screen has to guess one.
 *
 * The questionnaire carried five of these written by hand — CZ, SK, PL, DE,
 * AT — which meant a Hungarian could not describe his number at all, and
 * nobody found out: he simply gave up, and the clinic learnt nothing.
 *
 * The order is ISO. Which countries belong at the top is a fact about this
 * clinic's patients rather than about the list, so `withPreferredFirst` does
 * that here, exactly as the desk does.
 */
export async function publicPhoneRegions(): Promise<PublicPhoneRegion[]> {
  const response = await publicClient.get<PublicPhoneRegion[]>(
    '/api/public/contact-check/phone-regions',
  );
  return response.data ?? [];
}
