import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/*
 * The three colours a document's standing is drawn in.
 *
 * The owner asked for these and was told "prahy áno, farby raz pre celú
 * aplikáciu" - then the second half was not built, and he found it: "bavili
 * sme sa s backendom ze budem moct nastavit i farby alertov ... nevidim to
 * nikde". He was right; it existed as an answer and not as a screen.
 *
 * Once for the whole application, never per rule. A colour is the word for a
 * state, and the same state should not be green on one screen and amber on
 * another. What DOES belong on the rule is `warnDaysBefore` - when amber
 * starts is a clinical decision and can differ by service; what amber LOOKS
 * like is not.
 *
 * And never colour alone. Every place these are used says the state in words
 * and gives the date as well - that was true before this existed and it is
 * why this is only paint.
 */

export const alertColoursSchema = z.object({
  /** Covers the appointment with room to spare. */
  valid: z.string(),
  /** Covers it, and runs out within the rule's warning days. */
  expiringSoon: z.string(),
  /** Nothing on file, or what is on file no longer covers it. */
  notCovered: z.string(),
});
export type AlertColours = z.infer<typeof alertColoursSchema>;

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Deliberately not logged: a response body may carry personal data (6.7).
    throw toBookingError(error);
  }
}

export const alertColoursApi = {
  /*
   * Never answers empty. When nobody has chosen, the server sends a plain
   * traffic light - so no screen has to invent a colour, and none of them
   * disagree about what "unset" looks like. Measured on 14. 9. 2026:
   * `#2e7d32 / #ed6c02 / #c62828`.
   */
  get: (): Promise<AlertColours> =>
    request(async () => {
      const res = await client.get('/api/settings/alert-colours');
      return parseResponse(alertColoursSchema, res.data);
    }),

  /*
   * All three together, and the server refuses the lot when one is wrong -
   * "Barva musí být ve tvaru #rrggbb", measured against `"red"`. A palette
   * half applied is a screen wearing colours nobody picked.
   */
  save: (colours: AlertColours): Promise<AlertColours> =>
    request(async () => {
      const res = await client.put('/api/settings/alert-colours', colours);
      return parseResponse(alertColoursSchema, res.data);
    }),
};
