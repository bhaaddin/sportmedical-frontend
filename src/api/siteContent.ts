/* ══════════════════════════════════════════════════════════════
   PUBLIC SITE CONTENT  (contract C5)

   GET /api/public/site-content →
     { version, slots: { "<key>": { kind, text?, mediaUrl?, posterUrl?, alt?, width?, height? } },
       partners: [...], faq: [...] }

   The registry of known slots lives in src/site/siteSlots.ts. This file reads
   what the admin has put in them and merges it over the registry's defaults, so
   a page renders correctly with no API at all (prerender while the server
   sleeps, an offline visitor) and swaps in the admin's text and files when they
   arrive.
   ══════════════════════════════════════════════════════════════ */

import { useQuery } from '@tanstack/react-query';
import { unwrapEnvelope, webHttp } from '../web/http';
import { DEFAULT_SITE_CONTENT } from '../site/defaults';
import { slotDef } from '../site/siteSlots';
import type { SlotKind } from '../site/slotTypes';

export interface SiteSlotValue {
  kind: SlotKind;
  text?: string;
  mediaUrl?: string;
  posterUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
  /** Video only: the admin chose a muted looping clip. Absent = click to play, with controls. */
  autoplay?: boolean;
}

export interface SitePartner {
  id: string;
  name: string;
  sport: string;
  description: string;
  url: string;
  logoUrl?: string;
  sort: number;
}

export interface SiteFaq {
  id: string;
  question: string;
  answer: string;
  sort: number;
}

export interface SiteContent {
  version: string;
  slots: Record<string, SiteSlotValue>;
  partners: SitePartner[];
  faq: SiteFaq[];
}

export const SITE_CONTENT_KEY = ['web', 'site-content'] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

function normalizeSlot(raw: unknown): SiteSlotValue | null {
  if (!isObject(raw)) return null;
  const kind = raw.kind === 'image' || raw.kind === 'video' || raw.kind === 'text' ? raw.kind : null;
  if (kind === null) return null;
  const slot: SiteSlotValue = { kind };
  const text = str(raw.text);
  if (text !== undefined) slot.text = text;
  const mediaUrl = str(raw.mediaUrl);
  if (mediaUrl !== undefined && mediaUrl.trim() !== '') slot.mediaUrl = mediaUrl.trim();
  const posterUrl = str(raw.posterUrl);
  if (posterUrl !== undefined && posterUrl.trim() !== '') slot.posterUrl = posterUrl.trim();
  const alt = str(raw.alt);
  if (alt !== undefined) slot.alt = alt;
  const width = num(raw.width);
  if (width !== undefined) slot.width = width;
  const height = num(raw.height);
  if (height !== undefined) slot.height = height;
  if (raw.autoplay === true) slot.autoplay = true;
  return slot;
}

/**
 * What the API sent, made safe. Anything that is not understood is dropped, never thrown on:
 * a public page must not break because the admin's data has an odd row. Returns null when the
 * payload is not a site-content object at all.
 *
 * Partners and FAQ: an empty list from the API means "nobody has entered any yet" and the
 * defaults are shown, so a new installation does not render an empty marquee.
 */
export function normalizeSiteContent(raw: unknown): SiteContent | null {
  const body = unwrapEnvelope(raw);
  if (!isObject(body)) return null;

  const slots: Record<string, SiteSlotValue> = {};
  if (isObject(body.slots)) {
    for (const [key, value] of Object.entries(body.slots)) {
      const slot = normalizeSlot(value);
      if (slot !== null) slots[key] = slot;
    }
  }

  const partners: SitePartner[] = Array.isArray(body.partners)
    ? body.partners.flatMap((item, index): SitePartner[] => {
        if (!isObject(item) || typeof item.name !== 'string' || item.name.trim() === '') return [];
        return [{
          id: str(item.id) ?? `p-${index}`,
          name: item.name.trim(),
          sport: str(item.sport) ?? '',
          description: str(item.description) ?? '',
          url: str(item.url) ?? '',
          ...(str(item.logoUrl) ? { logoUrl: str(item.logoUrl) } : {}),
          sort: typeof item.sort === 'number' ? item.sort : index,
        }];
      }).sort((a, b) => a.sort - b.sort)
    : [];

  const faq: SiteFaq[] = Array.isArray(body.faq)
    ? body.faq.flatMap((item, index): SiteFaq[] => {
        if (!isObject(item) || typeof item.question !== 'string' || typeof item.answer !== 'string') return [];
        if (item.question.trim() === '') return [];
        return [{
          id: str(item.id) ?? `f-${index}`,
          question: item.question.trim(),
          answer: item.answer,
          sort: typeof item.sort === 'number' ? item.sort : index,
        }];
      }).sort((a, b) => a.sort - b.sort)
    : [];

  return {
    version: str(body.version) ?? '',
    slots,
    partners: partners.length > 0 ? partners : DEFAULT_SITE_CONTENT.partners,
    faq: faq.length > 0 ? faq : DEFAULT_SITE_CONTENT.faq,
  };
}

/** Throws when the server cannot be reached or answers nonsense: the caller keeps what it had. */
export async function fetchSiteContent(): Promise<SiteContent> {
  const { data } = await webHttp.get<unknown>('/api/public/site-content');
  const content = normalizeSiteContent(data);
  if (content === null) throw new Error('site-content: unexpected response');
  return content;
}

/**
 * The site content, always defined: the registry defaults at first (and when the API is down),
 * the admin's content once it has arrived. In a prerendered page the build-time answer is already
 * in the cache, so the first render matches the HTML; the query then refreshes it.
 */
export function useSiteContent() {
  return useQuery<SiteContent>({
    queryKey: SITE_CONTENT_KEY,
    queryFn: fetchSiteContent,
    initialData: () => DEFAULT_SITE_CONTENT,
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** One slot as the page needs it: the admin's value over the registry's default. */
export interface ResolvedSlot {
  key: string;
  kind: SlotKind;
  /** Text slots: the admin's text, else the registry default. '' for a media slot. */
  text: string;
  /** Media slots: the uploaded file, when there is one. */
  mediaUrl?: string;
  posterUrl?: string;
  alt: string;
  width?: number;
  height?: number;
  autoplay: boolean;
  /** Placeholder caption of a media slot, from the registry. */
  caption: string;
  recommended?: string;
  aspect?: string;
}

/** Pure part of useSlot, so it can be tested and used outside React. */
export function resolveSlot(content: SiteContent, key: string, fallbackText = ''): ResolvedSlot {
  const def = slotDef(key);
  const value = content.slots[key];
  const kind: SlotKind = value?.kind ?? def?.kind ?? 'text';
  const adminText = value?.text !== undefined && value.text.trim() !== '' ? value.text : undefined;
  return {
    key,
    kind,
    text: kind === 'text' ? adminText ?? def?.defaultText ?? fallbackText : '',
    ...(value?.mediaUrl !== undefined ? { mediaUrl: value.mediaUrl } : {}),
    ...(value?.posterUrl !== undefined ? { posterUrl: value.posterUrl } : {}),
    alt: value?.alt ?? '',
    ...(value?.width !== undefined ? { width: value.width } : {}),
    ...(value?.height !== undefined ? { height: value.height } : {}),
    autoplay: value?.autoplay === true,
    caption: def?.caption ?? '',
    ...(def?.recommended !== undefined ? { recommended: def.recommended } : {}),
    ...(def?.aspect !== undefined ? { aspect: def.aspect } : {}),
  };
}

export function useSlot(key: string, fallbackText = ''): ResolvedSlot {
  const { data } = useSiteContent();
  return resolveSlot(data ?? DEFAULT_SITE_CONTENT, key, fallbackText);
}

/** The partner clubs (admin's list, else the ten defaults). */
export function usePartners(): SitePartner[] {
  return useSiteContent().data?.partners ?? DEFAULT_SITE_CONTENT.partners;
}

/** The FAQ (admin's list, else the defaults shared with the booking page). */
export function useFaq(): SiteFaq[] {
  return useSiteContent().data?.faq ?? DEFAULT_SITE_CONTENT.faq;
}
