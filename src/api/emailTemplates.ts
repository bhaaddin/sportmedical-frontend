import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/*
 * The e-mails the system sends, as the owner edits them in Nastavení.
 *
 * The backend (`EmailTemplatesController`, permission `communication.manage`)
 * has carried the whole of this from the start — list, read, save with
 * placeholder validation, reset to the shipped wording, a preview with sample
 * values, and a real test-send to the signed-in employee. Nothing here reached
 * a screen, so the clinic's own messages could not be changed without a deploy.
 * This client is the first half of ending that; `EmailTemplatesPage` is the rest.
 */

const placeholderSchema = z.object({
  key: z.string(),
  description: z.string(),
  sample: z.string(),
  isHtml: z.boolean(),
});

const templateSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  subject: z.string(),
  bodyHtml: z.string(),
  placeholders: z.array(placeholderSchema),
  isCustomized: z.boolean(),
  version: z.number(),
  updatedAt: z.string().nullable().optional(),
});

const templateListSchema = z.array(templateSchema);

const renderedSchema = z.object({
  subject: z.string(),
  bodyHtml: z.string(),
});

const testSendSchema = z.object({
  sentTo: z.string(),
  subject: z.string(),
});

export type EmailPlaceholder = z.infer<typeof placeholderSchema>;
export type EmailTemplate = z.infer<typeof templateSchema>;
export type RenderedEmail = z.infer<typeof renderedSchema>;
export type TestSendResult = z.infer<typeof testSendSchema>;

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Deliberately not logged: a rendered preview may carry a patient's name.
    throw toBookingError(error);
  }
}

export const emailTemplatesApi = {
  /** Every template the clinic sends, for the list on the left. */
  list: (): Promise<EmailTemplate[]> =>
    request(async () => {
      const res = await client.get('/api/email-templates');
      return parseResponse(templateListSchema, res.data);
    }),

  get: (code: string): Promise<EmailTemplate> =>
    request(async () => {
      const res = await client.get(`/api/email-templates/${encodeURIComponent(code)}`);
      return parseResponse(templateSchema, res.data);
    }),

  /**
   * Saves subject + body. The server refuses, with the list of offending
   * placeholders, when the wording uses one the template does not define — so
   * `toBookingError` carries that message straight to the editor.
   */
  save: (code: string, subject: string, bodyHtml: string): Promise<EmailTemplate> =>
    request(async () => {
      const res = await client.put(`/api/email-templates/${encodeURIComponent(code)}`, { subject, bodyHtml });
      return parseResponse(templateSchema, res.data);
    }),

  /** Back to the wording the system shipped with. */
  reset: (code: string): Promise<EmailTemplate> =>
    request(async () => {
      const res = await client.post(`/api/email-templates/${encodeURIComponent(code)}/reset`, {});
      return parseResponse(templateSchema, res.data);
    }),

  /**
   * The e-mail as a patient would get it, with sample values. Unsaved subject
   * and body are sent so the editor previews what is on screen, not what is
   * stored.
   */
  preview: (code: string, subject: string, bodyHtml: string): Promise<RenderedEmail> =>
    request(async () => {
      const res = await client.post(`/api/email-templates/${encodeURIComponent(code)}/preview`, { subject, bodyHtml });
      return parseResponse(renderedSchema, res.data);
    }),

  /** Really sends the template, with sample values, to the signed-in employee. */
  testSend: (code: string): Promise<TestSendResult> =>
    request(async () => {
      const res = await client.post(`/api/email-templates/${encodeURIComponent(code)}/test-send`, {});
      return parseResponse(testSendSchema, res.data);
    }),
};

export default emailTemplatesApi;
