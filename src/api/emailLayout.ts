import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/*
 * The header and footer every e-mail is framed in (Nastavení → Zprávy → Hlavička a patička). Its own module so the
 * calendar's bundle, which imports the template API for "Poslat zprávu", does not carry it.
 * Blank text = the default (clinic name, the e-mail's subject, the stock small print).
 */

const layoutSchema = z.object({
  headerTitle: z.string().nullish().transform((v) => v ?? ''),
  headerTagline: z.string().nullish().transform((v) => v ?? ''),
  logoUrl: z.string().nullish().transform((v) => v ?? ''),
  footerText: z.string().nullish().transform((v) => v ?? ''),
  showContacts: z.boolean().default(true),
  smallPrint: z.string().nullish().transform((v) => v ?? ''),
});

const renderedSchema = z.object({ subject: z.string(), bodyHtml: z.string() });

/* Whether every e-mail about a termín carries the patient's own "Změnit nebo zrušit termín" button. */
const selfServiceSchema = z.object({ enabled: z.boolean().default(true) });

export type EmailLayout = z.infer<typeof layoutSchema>;
export type RenderedLayout = z.infer<typeof renderedSchema>;

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export const emailLayoutApi = {
  get: (): Promise<EmailLayout> =>
    request(async () => parseResponse(layoutSchema, (await client.get('/api/email-templates/layout')).data)),

  save: (layout: EmailLayout): Promise<EmailLayout> =>
    request(async () => parseResponse(layoutSchema, (await client.put('/api/email-templates/layout', layout)).data)),

  selfService: (): Promise<boolean> =>
    request(async () => parseResponse(selfServiceSchema, (await client.get('/api/email-templates/self-service')).data).enabled),

  saveSelfService: (enabled: boolean): Promise<boolean> =>
    request(async () => parseResponse(selfServiceSchema, (await client.put('/api/email-templates/self-service', { enabled })).data).enabled),

  /** A sample e-mail in the given header and footer, before they are saved. */
  preview: (layout: EmailLayout): Promise<RenderedLayout> =>
    request(async () => parseResponse(renderedSchema, (await client.post('/api/email-templates/layout/preview', layout)).data)),
};
