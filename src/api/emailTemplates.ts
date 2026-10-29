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
  /* Messages contract (2026-10-29). A server that predates it sends none of these three, so each has a default. */
  isCustom: z.boolean().default(false),
  /** null = a custom template, which is never sent by itself. */
  autoSend: z.boolean().nullish().transform((value) => value ?? null),
  audience: z.enum(['patient', 'club', 'any']).default('patient'),
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

const sendResultSchema = z.object({
  recipients: z.number(),
  skippedWithoutEmail: z.number(),
  subject: z.string(),
  bodyHtml: z.string(),
  queued: z.number(),
});

const calendarSchema = z.object({ alarmMinutes: z.array(z.number()) });

export type TemplateAudience = 'patient' | 'club' | 'any';
export type SendTarget =
  | { kind: 'patient'; id: string }
  | { kind: 'club'; id: string; includePlayers: boolean };
export type SendResult = z.infer<typeof sendResultSchema>;
export type CalendarSettings = z.infer<typeof calendarSchema>;
export interface NewCustomTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  audience: TemplateAudience;
}

/** The most alarms the calendar file carries, and the largest lead (14 days) - the contract's bounds. */
export const MAX_CALENDAR_ALARMS = 4;
export const MAX_ALARM_MINUTES = 20160;

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
  save: (code: string, subject: string, bodyHtml: string, name?: string): Promise<EmailTemplate> =>
    request(async () => {
      const body = name === undefined ? { subject, bodyHtml } : { name, subject, bodyHtml };
      const res = await client.put(`/api/email-templates/${encodeURIComponent(code)}`, body);
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

  /** A message of the clinic's own. The server derives the code from the name. */
  create: (template: NewCustomTemplate): Promise<EmailTemplate> =>
    request(async () => {
      const res = await client.post('/api/email-templates', template);
      return parseResponse(templateSchema, res.data);
    }),

  /** Custom messages only; a built-in one answers 400 `email_template.builtin`. */
  remove: (code: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/email-templates/${encodeURIComponent(code)}`);
    }),

  /** Switches the automatic sending of a built-in message on or off. */
  setAutoSend: (code: string, enabled: boolean): Promise<void> =>
    request(async () => {
      await client.put(`/api/email-templates/${encodeURIComponent(code)}/auto-send`, { enabled });
    }),

  /** Minutes before the start at which the calendar file alarms. */
  getCalendar: (): Promise<CalendarSettings> =>
    request(async () => {
      const res = await client.get('/api/email-templates/calendar');
      return parseResponse(calendarSchema, res.data);
    }),

  saveCalendar: (alarmMinutes: number[]): Promise<void> =>
    request(async () => {
      await client.put('/api/email-templates/calendar', { alarmMinutes });
    }),

  /**
   * Sends a template to a patient or a club (with its players). `dryRun` queues
   * nothing and returns the sample for the first recipient; addresses never come back.
   */
  send: (code: string, target: SendTarget, dryRun: boolean): Promise<SendResult> =>
    request(async () => {
      const res = await client.post(`/api/email-templates/${encodeURIComponent(code)}/send`, { target, dryRun });
      return parseResponse(sendResultSchema, res.data);
    }),
};

export default emailTemplatesApi;
