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
});
export type RequirementRule = z.infer<typeof requirementRuleSchema>;
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

  add: (templateId: string, clinicServiceId: string): Promise<RequirementRule> =>
    request(async () => {
      const res = await client.post('/api/documents/requirements', {
        templateId,
        clinicServiceId,
      });
      return parseResponse(requirementRuleSchema, res.data);
    }),

  remove: (ruleId: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/documents/requirements/${ruleId}`);
    }),
};
