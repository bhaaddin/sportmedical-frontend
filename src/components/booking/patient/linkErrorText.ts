/*
 * Why a completion link could not be issued, in the server's own words.
 *
 * `POST /api/patients/{id}/registration-link` refuses with a Czech sentence the desk should read:
 * "Registrace tohoto pacienta je úplná (má adresu i pojištění), odkaz k dokončení není potřeba."
 * or "Pacient nemá v kartě e-mail." The screen used to swallow all of them into one "zkuste to
 * znovu", which sent the desk off to retry something that was never going to work.
 *
 * Only the `message` of a 400/404/409 answer is used (a short sentence written by the server, never
 * the raw body: a body may carry personal data), and only when it is plain text of sane length.
 */

const GENERIC = 'Odkaz se nepodařilo vygenerovat. Zkuste to prosím znovu.';

export function linkErrorText(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const status = response?.status;
  if (status !== 400 && status !== 404 && status !== 409) return GENERIC;
  const message = (response?.data as { message?: unknown } | undefined)?.message;
  if (typeof message !== 'string') return GENERIC;
  const text = message.trim();
  return text.length > 0 && text.length <= 300 ? text : GENERIC;
}
