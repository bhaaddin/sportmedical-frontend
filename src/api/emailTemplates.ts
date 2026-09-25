/* ══════════════════════════════════════════════════════════════
   The e-mails the system sends, as the owner edits them.

     GET  /api/email-templates                the five templates, with placeholders
     PUT  /api/email-templates/{code}         subject + body; refused with the
                                              unknown placeholders named
     POST /api/email-templates/{code}/preview rendered with sample values,
                                              optionally from unsaved text
     POST /api/email-templates/{code}/reset   back to the shipped wording
     POST /api/email-templates/{code}/test-send  really sends to the signed-in
                                              employee; 409 when SMTP is not set

   All of it needs communication.manage.
   ══════════════════════════════════════════════════════════════ */
import { client } from './client';

export interface EmailPlaceholder {
  key: string;
  description: string;
  sample: string;
  /** A ready-made link the template inserts as HTML; text placeholders are escaped. */
  isHtml: boolean;
}

export interface EmailTemplate {
  code: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  bodyHtml: string;
  placeholders: EmailPlaceholder[];
  /** Whether the clinic changed the wording; false means the shipped text. */
  isCustomized: boolean;
  version: number;
  updatedAt: string | null;
}

export interface RenderedEmail {
  subject: string;
  bodyHtml: string;
}

export interface TestSendResult {
  sentTo: string;
  subject: string;
}

export const emailTemplatesApi = {
  list: async (): Promise<EmailTemplate[]> => {
    const { data } = await client.get<EmailTemplate[]>('/api/email-templates');
    return Array.isArray(data) ? data : [];
  },

  save: async (code: string, input: { subject: string; bodyHtml: string }): Promise<EmailTemplate> => {
    const { data } = await client.put<EmailTemplate>(`/api/email-templates/${encodeURIComponent(code)}`, input);
    return data;
  },

  preview: async (code: string, draft: { subject?: string; bodyHtml?: string }): Promise<RenderedEmail> => {
    const { data } = await client.post<RenderedEmail>(`/api/email-templates/${encodeURIComponent(code)}/preview`, draft);
    return data;
  },

  reset: async (code: string): Promise<EmailTemplate> => {
    const { data } = await client.post<EmailTemplate>(`/api/email-templates/${encodeURIComponent(code)}/reset`);
    return data;
  },

  sendTest: async (code: string): Promise<TestSendResult> => {
    const { data } = await client.post<TestSendResult>(`/api/email-templates/${encodeURIComponent(code)}/test-send`);
    return data;
  },
};

/** The placeholders a subject or body mentions, in order of first appearance. */
export function placeholdersIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g)) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/** Placeholders the text uses that this template does not offer - what the server will refuse. */
export function unknownPlaceholders(template: Pick<EmailTemplate, 'placeholders'>, subject: string, bodyHtml: string): string[] {
  const allowed = new Set(template.placeholders.map((p) => p.key));
  return [...new Set([...placeholdersIn(subject), ...placeholdersIn(bodyHtml)])].filter((key) => !allowed.has(key));
}

/** What the server's refusal means, in words for the person at the screen. */
export function templateRefusal(error: unknown): string {
  const data = (error as { response?: { status?: number; data?: { code?: string; message?: string } } })?.response?.data;
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (data?.message) return data.message;
  if (status === 403) return 'Šablony e-mailů smí upravovat jen ten, kdo má oprávnění communication.manage.';
  return 'Požadavek se nepodařilo provést.';
}
