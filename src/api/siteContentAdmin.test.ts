/*
 * The admin side of the site content (contract C5): tolerant reading, the request each call makes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const { get, post, put, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  const client = { get, post, put, delete: del };
  return { ...actual, default: client, client };
});

import { parseAdminSiteContent, problemOf, siteContentAdminApi } from './siteContentAdmin';

beforeEach(() => {
  [get, post, put, del].forEach((m) => m.mockReset());
});

describe('parseAdminSiteContent', () => {
  it('reads slots with who/when, partners and FAQ in order, ignoring unknown keys', () => {
    const content = parseAdminSiteContent({
      version: 'v7',
      unknown: true,
      slots: {
        'landing.hero.eyebrow': { kind: 'text', text: 'Ahoj', updatedAtUtc: '2026-10-03T10:00:00Z', updatedBy: 'Jana', somethingNew: 1 },
        'landing.hero.photo1': { kind: 'image', mediaUrl: 'https://x/y.jpg', alt: 'Hala', width: 1600, height: 900, assetId: 12 },
      },
      partners: [
        { id: 'b', name: 'Beta', sport: 'Rugby', description: '', url: '', sort: 2 },
        { id: 'a', name: 'Alfa', sort: 1, logoUrl: 'https://x/a.png' },
      ],
      faq: [{ id: 1, question: 'Q?', answer: 'A.', sort: 1 }],
    });

    expect(content?.version).toBe('v7');
    expect(content?.slots['landing.hero.eyebrow']).toEqual({ kind: 'text', text: 'Ahoj', updatedAtUtc: '2026-10-03T10:00:00Z', updatedBy: 'Jana' });
    expect(content?.slots['landing.hero.photo1']).toEqual({ kind: 'image', mediaUrl: 'https://x/y.jpg', alt: 'Hala', width: 1600, height: 900, assetId: '12' });
    expect(content?.partners.map((p) => p.name)).toEqual(['Alfa', 'Beta']);
    expect(content?.partners[0]).toEqual({ id: 'a', name: 'Alfa', sport: '', description: '', url: '', logoUrl: 'https://x/a.png', sort: 1 });
    expect(content?.faq[0]).toEqual({ id: '1', question: 'Q?', answer: 'A.', sort: 1 });
  });

  it('drops a row it does not understand instead of failing the whole screen', () => {
    const content = parseAdminSiteContent({
      slots: { good: { kind: 'text', text: 'x' }, bad: { kind: 'hologram' }, worse: 'nope' },
      partners: [{ id: 'p', name: '   ' }, { name: 'Bez id', sort: 1 }, 7],
      faq: [{ id: 'f', question: '', answer: 'x' }],
    });
    expect(Object.keys(content?.slots ?? {})).toEqual(['good']);
    expect(content?.partners.map((p) => p.name)).toEqual([]);
    expect(content?.faq).toEqual([]);
  });

  it('accepts a missing partners/faq/slots, the shared envelope, and a slots array with keys', () => {
    expect(parseAdminSiteContent({})).toEqual({ version: '', slots: {}, partners: [], faq: [] });
    expect(parseAdminSiteContent({ success: true, data: { slots: [{ key: 'k', kind: 'text', text: 't' }] } })?.slots).toEqual({ k: { kind: 'text', text: 't' } });
  });

  it('returns null when the answer is not an object', () => {
    expect(parseAdminSiteContent('<html>')).toBeNull();
    expect(parseAdminSiteContent(null)).toBeNull();
    expect(parseAdminSiteContent([])).toBeNull();
  });
});

describe('siteContentAdminApi', () => {
  it('reads GET /api/v1/site-content and throws on nonsense', async () => {
    get.mockResolvedValueOnce({ data: { slots: {} } });
    expect((await siteContentAdminApi.get()).slots).toEqual({});
    expect(get).toHaveBeenCalledWith('/api/v1/site-content');

    get.mockResolvedValueOnce({ data: 'oops' });
    await expect(siteContentAdminApi.get()).rejects.toThrow('unexpected');
  });

  it('writes a slot with PUT and returns it parsed; the key is URL-encoded', async () => {
    put.mockResolvedValue({ data: { kind: 'text', text: 'Nové', updatedBy: 'Jana' } });
    const slot = await siteContentAdminApi.putSlot('landing.hero.eyebrow', { text: 'Nové' });
    expect(put).toHaveBeenCalledWith('/api/v1/site-content/slots/landing.hero.eyebrow', { text: 'Nové' });
    expect(slot).toEqual({ kind: 'text', text: 'Nové', updatedBy: 'Jana' });

    put.mockResolvedValue({ data: '' });
    expect(await siteContentAdminApi.putSlot('a b', { alt: 'x' })).toBeNull();
    expect(put).toHaveBeenLastCalledWith('/api/v1/site-content/slots/a%20b', { alt: 'x' });
  });

  it('resets a slot with DELETE', async () => {
    del.mockResolvedValue({ data: {} });
    await siteContentAdminApi.deleteSlot('landing.hero.eyebrow');
    expect(del).toHaveBeenCalledWith('/api/v1/site-content/slots/landing.hero.eyebrow');
  });

  it('creates, updates and deletes partners and FAQ items on their own paths', async () => {
    post.mockResolvedValue({ data: { id: 'p1', name: 'Alfa', sort: 1 } });
    put.mockResolvedValue({ data: {} });
    del.mockResolvedValue({ data: {} });

    const created = await siteContentAdminApi.createPartner({ name: 'Alfa', sport: '', description: '', url: '', sort: 1, logoAssetId: 'a9' });
    expect(post).toHaveBeenCalledWith('/api/v1/site-content/partners', { name: 'Alfa', sport: '', description: '', url: '', sort: 1, logoAssetId: 'a9' });
    expect(created?.id).toBe('p1');

    await siteContentAdminApi.updatePartner('p1', { name: 'Alfa', sport: '', description: '', url: '', logoAssetId: null });
    expect(put).toHaveBeenCalledWith('/api/v1/site-content/partners/p1', expect.objectContaining({ logoAssetId: null }));
    await siteContentAdminApi.deletePartner('p1');
    expect(del).toHaveBeenCalledWith('/api/v1/site-content/partners/p1');

    await siteContentAdminApi.createFaq({ question: 'Q', answer: 'A', sort: 3 });
    expect(post).toHaveBeenLastCalledWith('/api/v1/site-content/faq', { question: 'Q', answer: 'A', sort: 3 });
    await siteContentAdminApi.updateFaq('f1', { question: 'Q', answer: 'A' });
    expect(put).toHaveBeenLastCalledWith('/api/v1/site-content/faq/f1', { question: 'Q', answer: 'A' });
    await siteContentAdminApi.deleteFaq('f1');
    expect(del).toHaveBeenLastCalledWith('/api/v1/site-content/faq/f1');
  });
});

describe('problemOf', () => {
  const refused = (data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status: 400, data } as never);

  it('prefers the server sentence, then the first field error, then the fallback — never the exception text', () => {
    expect(problemOf(refused({ message: 'Klíč není platný.' }), 'fallback')).toBe('Klíč není platný.');
    expect(problemOf(refused({ errors: { text: ['Text je moc dlouhý.'] } }), 'fallback')).toBe('Text je moc dlouhý.');
    expect(problemOf(refused({}), 'fallback')).toBe('fallback');
    expect(problemOf(new Error('socket hang up'), 'fallback')).toBe('fallback');
  });
});
