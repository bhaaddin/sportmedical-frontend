import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/*
 * Which služba makes a patient bring which document.
 *
 * One rule, one sentence: "anybody booked for a Sportovní lékařská prohlídka
 * has to bring a výpis". Every činnost under that service inherits it, and
 * nothing else in the application decides it.
 *
 * It used to hang off a price-list category, and those categories turned out
 * to be seed data nobody had written - so whether a patient had to produce a
 * medical record rested on a word the clinic had never chosen. It hangs off a
 * service now, which somebody at the clinic created on purpose.
 */

export const requirementRuleSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  /*
   * Null when the service it pointed at has been deleted. The rule survives
   * the service, which is why `serviceExists` exists at all.
   */
  clinicServiceId: z.string().nullish().transform((v) => v ?? null),
  /**
   * The service's name - and when the service is gone, the name it had when
   * the rule was made. Kept so the row is not nameless and can be recognised
   * well enough to delete.
   */
  serviceName: z.string().nullish().transform((v) => v ?? ''),
  /**
   * `false` when the service has been deleted.
   *
   * The rule then matches nothing and asks nobody for anything - and a list
   * that does not say so reads exactly like a clinic where every rule works.
   * That is the shape this project keeps finding, which is why the server
   * sends this rather than leaving it to be inferred from a missing name.
   */
  serviceExists: z.boolean(),

  /*
   * The four settings. Until 14. 9. 2026 a rule was only "šablona × služba"
   * and everything it did was fixed in the source - which is what the owner
   * objected to: "nastavit ci vsetky veci ktore su teraz v kode natvrdo".
   *
   * `z.coerce.number()` on purpose. The live contract types both counts as
   * `["integer","string"]`, so the server may answer with either; insisting
   * on a number would fail the parse on a string and empty the whole screen.
   */

  /** How long the document covers a visit, counted from its ISSUE date. 0 = never expires. */
  validityMonths: z.coerce.number().int(),
  /** How many days ahead to go amber. 0 = never warn. */
  warnDaysBefore: z.coerce.number().int(),
  /** Asked only at a first visit; otherwise at every one. */
  firstVisitOnly: z.boolean(),
  /**
   * A missing document REFUSES the booking (422), rather than warning.
   *
   * This reverses the owner's own rule from plan 2.4 - paperwork always warns,
   * because the patient is on the telephone and needs a slot now, so the desk
   * is told what is missing and does not turn them away. It is `false` on
   * every row today and must never be switched on by accident.
   */
  blocksBooking: z.boolean(),
});
export type RequirementRule = z.infer<typeof requirementRuleSchema>;

/** What `PUT` takes - the four settings and nothing else. */
export interface RequirementSettings {
  validityMonths: number;
  warnDaysBefore: number;
  firstVisitOnly: boolean;
  blocksBooking: boolean;
}
export const requirementRuleListSchema = z.array(requirementRuleSchema);

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Deliberately not logged: a response body may carry personal data (6.7).
    throw toBookingError(error);
  }
}

export const documentRequirementsApi = {
  list: (): Promise<RequirementRule[]> =>
    request(async () => {
      const res = await client.get('/api/documents/requirements');
      return parseResponse(requirementRuleListSchema, res.data);
    }),

  /*
   * Only the pair. The four settings have server defaults - 12 months, warn
   * 30 days ahead, every visit, warn rather than refuse - and sending our own
   * would be this screen quietly holding an opinion it has not been given.
   * They are changed afterwards, deliberately, on a screen that says what
   * each one does.
   */
  add: (templateId: string, clinicServiceId: string): Promise<RequirementRule> =>
    request(async () => {
      const res = await client.post('/api/documents/requirements', {
        templateId,
        clinicServiceId,
      });
      return parseResponse(requirementRuleSchema, res.data);
    }),

  /**
   * The whole settings block, as every write in this lane is (3.1).
   *
   * All four are `required` on the live contract, so leaving one out is not
   * "leave it alone" - it is a missing field. Every caller sends all four.
   */
  update: (ruleId: string, settings: RequirementSettings): Promise<RequirementRule> =>
    request(async () => {
      const res = await client.put(`/api/documents/requirements/${ruleId}`, settings);
      return parseResponse(requirementRuleSchema, res.data);
    }),

  remove: (ruleId: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/documents/requirements/${ruleId}`);
    }),
};
