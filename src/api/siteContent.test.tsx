import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { normalizeSiteContent, resolveSlot, useSiteContent, useSlot } from './siteContent';
import { DEFAULT_SITE_CONTENT } from '../site/defaults';
import { normalizePriceList, pickRows, lowestPrice, formatCzk, formatMinutes } from './priceList';
import { normalizeDiscountTiers, topTier, formatPercent } from './publicDiscounts';

const get = vi.fn();
vi.mock('../web/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../web/http')>();
  return { ...actual, webHttp: { get: (...args: unknown[]) => get(...args) } };
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => { get.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe('useSiteContent', () => {
  it('renders from the defaults at once and keeps them when the API fails', async () => {
    get.mockRejectedValue(new Error('Network Error'));
    // Read inside the render: react-query only re-renders for the properties a render has read.
    const { result } = renderHook(() => {
      const query = useSiteContent();
      return { data: query.data, isFetching: query.isFetching, isError: query.isError };
    }, { wrapper: wrapper() });
    // Defined on the very first render: the page never waits for the server.
    expect(result.current.data.partners).toHaveLength(10);
    expect(result.current.data.faq.length).toBeGreaterThan(0);
    await waitFor(() => { expect(get).toHaveBeenCalledWith('/api/public/site-content'); });
    await waitFor(() => { expect(result.current.isError).toBe(true); });
    // The failed refresh left the defaults in place.
    expect(result.current.data.version).toBe(DEFAULT_SITE_CONTENT.version);
    expect(result.current.data.partners).toHaveLength(10);
  });

  it('swaps in the admin content when the API answers', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: {
          version: 'v7',
          slots: { 'landing.hero.lead': { kind: 'text', text: 'Nový úvod' } },
          partners: [{ id: 'p1', name: 'HC Test', sport: 'Hokej', description: '', url: '', sort: 1 }],
          faq: [],
        },
      },
    });
    const { result } = renderHook(() => {
      const content = useSiteContent().data;
      return { content, lead: useSlot('landing.hero.lead') };
    }, { wrapper: wrapper() });
    await waitFor(() => { expect(result.current.content.version).toBe('v7'); });
    expect(result.current.lead.text).toBe('Nový úvod');
    expect(result.current.content.partners.map((p) => p.name)).toEqual(['HC Test']);
    // An empty FAQ from the API means "none entered yet": the defaults stay.
    expect(result.current.content.faq.length).toBeGreaterThan(0);
  });

  it('survives odd rows and a body that is not site content', () => {
    expect(normalizeSiteContent('nonsense')).toBeNull();
    expect(normalizeSiteContent(null)).toBeNull();
    const content = normalizeSiteContent({
      slots: { a: { kind: 'poster' }, b: 'x', c: { kind: 'image', mediaUrl: ' https://x/y.jpg ', width: -4 } },
      partners: [{ name: '' }, { name: 'Dobrý', sort: 2 }, { name: 'První', sort: 1 }, 7],
      faq: [{ question: 'Q?', answer: 'A' }, { question: '', answer: 'x' }, { answer: 'y' }],
    });
    expect(content?.slots).toEqual({ c: { kind: 'image', mediaUrl: 'https://x/y.jpg' } });
    expect(content?.partners.map((p) => p.name)).toEqual(['První', 'Dobrý']);
    expect(content?.faq).toHaveLength(1);
  });
});

describe('resolveSlot', () => {
  it('layers the admin value over the registry default and keeps media metadata', () => {
    const content = normalizeSiteContent({
      slots: { 'landing.hero.photo1': { kind: 'image', mediaUrl: 'https://x/y.jpg', alt: 'Foto', width: 800, height: 600 } },
    })!;
    const media = resolveSlot(content, 'landing.hero.photo1');
    expect(media).toMatchObject({ kind: 'image', mediaUrl: 'https://x/y.jpg', alt: 'Foto', width: 800, height: 600, caption: 'spiroergometrie na ergometru' });
    expect(resolveSlot(content, 'landing.hero.eyebrow').text).toBe('Klinika sportovní medicíny · Praha 4');
    expect(resolveSlot(content, 'unknown.key', 'náhradní').text).toBe('náhradní');
  });
});

describe('the price list helpers', () => {
  const list = normalizePriceList({
    success: true,
    data: [
      { category: 'Sportovní diagnostika', items: [
        { code: 'x', name: 'VO₂max analýza', description: '', priceCzk: 111, durationMinutes: 60 },
        { code: 'y', name: 'Základní diagnostika', description: '', priceCzk: null, durationMinutes: 0 },
      ] },
      { category: 'InBody 770 – tělesná analýza', items: [{ code: 'z', name: 'Základní InBody měření', description: '', priceCzk: 22, durationMinutes: 15 }] },
      { category: 'Broken', items: 'no' },
    ],
  });

  it('keeps only well-formed rows and treats a missing price as unknown', () => {
    expect(list).toHaveLength(2);
    expect(list[0].items[1]).toMatchObject({ priceCzk: null, durationMinutes: null });
    expect(normalizePriceList({ nope: 1 })).toEqual([]);
  });

  it('picks the rows of a service by the NAME of its category, then by item name', () => {
    const byCategory = pickRows(list, { category: /^sportovni diagnostika/, limit: 1 });
    expect(byCategory.map((i) => i.code)).toEqual(['x']);
    const byItem = pickRows(list, { category: /^neexistuje/, items: [/^zakladni inbody/, /^vo2max/], limit: 4 });
    expect(byItem.map((i) => i.code)).toEqual(['z', 'x']);
    expect(pickRows([], { category: /./, items: [/./], limit: 3 })).toEqual([]);
  });

  it('finds the cheapest price and formats Czech typography', () => {
    expect(lowestPrice(list)).toBe(22);
    expect(lowestPrice([])).toBeNull();
    expect(formatCzk(1234)).toBe('1 234 Kč');
    expect(formatCzk(null)).toBeNull();
    expect(formatMinutes(40)).toBe('40 min');
    expect(formatMinutes(0)).toBeNull();
  });
});

describe('the discount tiers', () => {
  it('accepts a list or { tiers }, drops nonsense and picks the biggest percent', () => {
    expect(normalizeDiscountTiers([{ minPersons: 10, percent: 15 }, { minPersons: 4, percent: 5 }, { minPersons: 0, percent: 3 }, 'x'])).toEqual([
      { minPersons: 4, percent: 5 },
      { minPersons: 10, percent: 15 },
    ]);
    expect(normalizeDiscountTiers({ success: true, data: { tiers: [{ minPersons: 6, percent: 10 }] } })).toEqual([{ minPersons: 6, percent: 10 }]);
    expect(normalizeDiscountTiers(undefined)).toEqual([]);
    expect(topTier([])).toBeNull();
    expect(topTier([{ minPersons: 4, percent: 5 }, { minPersons: 10, percent: 15 }])).toEqual({ minPersons: 10, percent: 15 });
    expect(formatPercent(15)).toBe('−15 %');
  });
});
