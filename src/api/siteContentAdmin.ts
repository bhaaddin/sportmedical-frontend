/* ══════════════════════════════════════════════════════════════
   SITE CONTENT — THE ADMIN'S SIDE  (contract C5)

     GET    /api/v1/site-content                     the public shape + updatedAtUtc, updatedBy per slot
     PUT    /api/v1/site-content/slots/{key}         { text?, alt?, assetId? }
     DELETE /api/v1/site-content/slots/{key}         back to the default
     POST   /api/v1/site-content/partners            PUT/DELETE …/partners/{id}
     POST   /api/v1/site-content/faq                 PUT/DELETE …/faq/{id}

   The contract does not spell out the partner/FAQ bodies. Assumed (and noted for
   the integrator): a partner is written as { name, sport, description, url, sort,
   logoAssetId? (null removes the logo) }, an FAQ item as { question, answer, sort }.

   Reading is tolerant: a row that is not understood is dropped rather than
   failing the whole screen, unknown keys are ignored, null is treated as missing.
   ══════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import client from './client';
import type { SlotKind } from '../site/slotTypes';

export const ADMIN_SITE_CONTENT_KEY = ['admin', 'site-content'] as const;

const optStr = z.string().nullish().transform((value) => (value === null || value === undefined || value === '' ? undefined : value));
const optNum = z.number().nullish().transform((value) => (value === null || value === undefined || !Number.isFinite(value) ? undefined : value));
const str = z.string().nullish().transform((value) => value ?? '');
const idLike = z.union([z.string(), z.number()]).transform(String);

export const adminSlotSchema = z.object({
  key: optStr,
  kind: z.enum(['text', 'image', 'video']),
  text: z.string().nullish().transform((value) => value ?? undefined),
  mediaUrl: optStr,
  posterUrl: optStr,
  alt: z.string().nullish().transform((value) => value ?? undefined),
  width: optNum,
  height: optNum,
  assetId: z.union([z.string(), z.number()]).nullish().transform((value) => (value === null || value === undefined ? undefined : String(value))),
  autoplay: z.boolean().nullish().transform((value) => (value === true ? true : undefined)),
  updatedAtUtc: optStr,
  updatedBy: optStr,
});

export const adminPartnerSchema = z.object({
  id: idLike,
  name: z.string().trim().min(1),
  sport: str,
  description: str,
  url: str,
  logoUrl: optStr,
  logoAssetId: z.union([z.string(), z.number()]).nullish().transform((value) => (value === null || value === undefined ? undefined : String(value))),
  sort: z.number().nullish().transform((value) => value ?? 0),
});

export const adminFaqSchema = z.object({
  id: idLike,
  question: z.string().trim().min(1),
  answer: str,
  sort: z.number().nullish().transform((value) => value ?? 0),
});

export interface AdminSlot {
  kind: SlotKind;
  text?: string;
  mediaUrl?: string;
  posterUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
  assetId?: string;
  autoplay?: boolean;
  updatedAtUtc?: string;
  updatedBy?: string;
}

export interface AdminPartner {
  id: string;
  name: string;
  sport: string;
  description: string;
  url: string;
  logoUrl?: string;
  logoAssetId?: string;
  sort: number;
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  sort: number;
}

export interface AdminSiteContent {
  version: string;
  slots: Record<string, AdminSlot>;
  partners: AdminPartner[];
  faq: AdminFaq[];
}

export const EMPTY_ADMIN_CONTENT: AdminSiteContent = { version: '', slots: {}, partners: [], faq: [] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Removes the fields that are undefined, so equality and spreads behave. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function parseAdminSlot(raw: unknown): AdminSlot | null {
  const parsed = adminSlotSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { key: _key, ...slot } = parsed.data;
  void _key;
  return compact(slot) as AdminSlot;
}

export function parseAdminPartner(raw: unknown): AdminPartner | null {
  const parsed = adminPartnerSchema.safeParse(raw);
  return parsed.success ? (compact(parsed.data) as AdminPartner) : null;
}

export function parseAdminFaq(raw: unknown): AdminFaq | null {
  const parsed = adminFaqSchema.safeParse(raw);
  return parsed.success ? (compact(parsed.data) as AdminFaq) : null;
}

const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;

/** What the server sent, made safe. Null only when it is not an object at all. */
export function parseAdminSiteContent(raw: unknown): AdminSiteContent | null {
  const envelope = isObject(raw) && 'success' in raw && 'data' in raw ? raw.data : raw;
  const body = isObject(envelope) && isObject(envelope.value) && !('slots' in envelope) ? envelope.value : envelope;
  if (!isObject(body)) return null;

  const slots: Record<string, AdminSlot> = {};
  if (isObject(body.slots)) {
    for (const [key, value] of Object.entries(body.slots)) {
      const slot = parseAdminSlot(value);
      if (slot !== null) slots[key] = slot;
    }
  } else if (Array.isArray(body.slots)) {
    for (const value of body.slots) {
      const key = isObject(value) && typeof value.key === 'string' ? value.key : undefined;
      const slot = key === undefined ? null : parseAdminSlot(value);
      if (key !== undefined && slot !== null) slots[key] = slot;
    }
  }

  const partners = (Array.isArray(body.partners) ? body.partners : [])
    .map(parseAdminPartner)
    .filter((item): item is AdminPartner => item !== null)
    .sort(bySort);
  const faq = (Array.isArray(body.faq) ? body.faq : [])
    .map(parseAdminFaq)
    .filter((item): item is AdminFaq => item !== null)
    .sort(bySort);

  return { version: typeof body.version === 'string' ? body.version : '', slots, partners, faq };
}

/* ── Request bodies ── */

export interface SlotUpdate {
  text?: string;
  alt?: string;
  assetId?: string;
}

export interface PartnerInput {
  name: string;
  sport: string;
  description: string;
  url: string;
  sort?: number;
  /** A new logo; `null` removes the one there is; absent leaves it alone. */
  logoAssetId?: string | null;
}

export interface FaqInput {
  question: string;
  answer: string;
  sort?: number;
}

const base = '/api/v1/site-content';

export const siteContentAdminApi = {
  get: async (): Promise<AdminSiteContent> => {
    const res = await client.get<unknown>(base);
    const content = parseAdminSiteContent(res.data);
    if (content === null) throw new Error('site-content: unexpected response');
    return content;
  },

  /** The server may answer with the slot or with nothing; the caller refetches either way. */
  putSlot: async (key: string, body: SlotUpdate): Promise<AdminSlot | null> => {
    const res = await client.put<unknown>(`${base}/slots/${encodeURIComponent(key)}`, body);
    return parseAdminSlot(res.data);
  },

  deleteSlot: async (key: string): Promise<void> => {
    await client.delete(`${base}/slots/${encodeURIComponent(key)}`);
  },

  createPartner: async (body: PartnerInput): Promise<AdminPartner | null> => {
    const res = await client.post<unknown>(`${base}/partners`, body);
    return parseAdminPartner(res.data);
  },
  updatePartner: async (id: string, body: PartnerInput): Promise<AdminPartner | null> => {
    const res = await client.put<unknown>(`${base}/partners/${encodeURIComponent(id)}`, body);
    return parseAdminPartner(res.data);
  },
  deletePartner: async (id: string): Promise<void> => {
    await client.delete(`${base}/partners/${encodeURIComponent(id)}`);
  },

  createFaq: async (body: FaqInput): Promise<AdminFaq | null> => {
    const res = await client.post<unknown>(`${base}/faq`, body);
    return parseAdminFaq(res.data);
  },
  updateFaq: async (id: string, body: FaqInput): Promise<AdminFaq | null> => {
    const res = await client.put<unknown>(`${base}/faq/${encodeURIComponent(id)}`, body);
    return parseAdminFaq(res.data);
  },
  deleteFaq: async (id: string): Promise<void> => {
    await client.delete(`${base}/faq/${encodeURIComponent(id)}`);
  },
};

/** The server's own sentence for a refusal, else `fallback`. Never the raw exception text. */
export function problemOf(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } } | null)?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim() !== '') return data.message;
  if (isObject(data?.errors)) {
    for (const messages of Object.values(data.errors)) {
      if (Array.isArray(messages) && typeof messages[0] === 'string') return messages[0];
    }
  }
  return fallback;
}
