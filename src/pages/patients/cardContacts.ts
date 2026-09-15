/*
 * The e-mail and telephone on a patient's card.
 *
 * Both read `—` for every patient, and had three independent faults stacked on
 * top of each other — each one alone enough to empty the row:
 *
 *   1. the rows read `patient.email` / `patient.phone`, and
 *      `GET /api/v1/patients/{id}` does not carry them. Measured: it returns
 *      name, dates, sex, status, revision, and nothing else.
 *
 *   2. a fallback to the registration profile was written and never used —
 *      `displayEmail` and `displayPhone` sat there as dead locals, which is
 *      what the lint warning about them was actually telling us.
 *
 *   3. that fallback looked for `c.channel === 'email'`, and the server sends
 *      `type`. Measured, byte for byte:
 *
 *        contactsJson: "[{\"type\":\"email\",\"value\":\"...\"},
 *                        {\"type\":\"phone\",\"value\":\"\u002B420 777 777 779\"}]"
 *
 * The data was there the whole time, at `GET /api/patients/{id}/profile`.
 */

export interface ProfileContact {
  type: string;
  value: string;
}

/**
 * The contacts the registration profile carries, or none.
 *
 * `contactsJson` is a JSON STRING inside a JSON object, so it can be absent,
 * empty, malformed, or — measured — a perfectly good array. A card must not
 * disappear because one field did not parse, so anything unreadable is simply
 * no contacts.
 */
export function profileContacts(contactsJson: unknown): ProfileContact[] {
  if (typeof contactsJson !== 'string' || contactsJson.trim() === '') return [];

  try {
    const parsed: unknown = JSON.parse(contactsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ProfileContact =>
        typeof entry === 'object' && entry !== null
        && typeof (entry as ProfileContact).type === 'string'
        && typeof (entry as ProfileContact).value === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * One contact of a kind, preferring whatever the patient record already had.
 *
 * `preferred` is the field on the patient itself. It is empty today for every
 * patient, and this is written so that the row starts working on its own the
 * day that endpoint begins carrying contacts — without a second place having
 * to be found and changed.
 */
export function contactOfKind(
  kind: string,
  preferred: string | undefined,
  contacts: readonly ProfileContact[],
): string {
  if (preferred !== undefined && preferred.trim() !== '') return preferred;
  return contacts.find((contact) => contact.type === kind)?.value ?? '';
}
