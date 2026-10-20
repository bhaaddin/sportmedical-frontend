/*
 * Settings audit (20. 10. 2026) - how the client reads GET /api/v1/settings/clubs and what it sends back.
 * Measured on the dev API: the body also carries blockPalette (another screen owns it), the two payer sentences and their defaults.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('./client', () => ({ default: { get, put }, client: { get, put } }));

const { clubSettingsApi, CLUB_SETTINGS_QUERY_KEY } = await import('./clubs');
const { REFERENCE_KEYS } = await import('./queryClient');

const BODY = {
  registrationLinkValidityDays: 30, minimumPlayers: 8, releaseUnusedDaysBefore: 3, allowMultiServiceOrders: true,
  blockPalette: ['#2563EB'], payerTextClubInvoice: 'Platí klub.', payerTextPerPerson: null,
  defaultPayerTextClubInvoice: 'Výchozí A.', defaultPayerTextPerPerson: 'Výchozí B.',
};

beforeEach(() => {
  get.mockReset();
  put.mockReset();
});

describe('clubSettingsApi.get', () => {
  it('maps every field, the palette and the payer sentences included', async () => {
    get.mockResolvedValue({ data: BODY });
    expect(await clubSettingsApi.get()).toEqual(BODY);
    expect(get).toHaveBeenCalledWith('/api/v1/settings/clubs');
  });

  it('reads an empty body as the defaults: 14 days, no minimum, never release, one služba per order', async () => {
    get.mockResolvedValue({ data: {} });
    expect(await clubSettingsApi.get()).toMatchObject({
      registrationLinkValidityDays: 14, minimumPlayers: null, releaseUnusedDaysBefore: null, allowMultiServiceOrders: false, payerTextClubInvoice: null, payerTextPerPerson: null,
    });
  });

  it('does not invent a palette that the server did not send', async () => {
    get.mockResolvedValue({ data: { registrationLinkValidityDays: 14 } });
    expect(await clubSettingsApi.get()).not.toHaveProperty('blockPalette');
  });

  it.each([
    ['a string where a number is expected', { registrationLinkValidityDays: '30' }, 14],
    ['NaN', { registrationLinkValidityDays: Number.NaN }, 14],
    ['null', { registrationLinkValidityDays: null }, 14],
  ])('falls back to 14 days for %s', async (_label, body, expected) => {
    get.mockResolvedValue({ data: body });
    expect((await clubSettingsApi.get()).registrationLinkValidityDays).toBe(expected);
  });

  it('only true switches multi-service orders on', async () => {
    for (const [value, expected] of [[true, true], ['true', false], [1, false], [undefined, false]] as const) {
      get.mockResolvedValue({ data: { allowMultiServiceOrders: value } });
      expect((await clubSettingsApi.get()).allowMultiServiceOrders).toBe(expected);
    }
  });

  it('reads a blank payer sentence as none, so the default is what parents get', async () => {
    get.mockResolvedValue({ data: { payerTextClubInvoice: '   ', payerTextPerPerson: '' } });
    const settings = await clubSettingsApi.get();
    expect(settings.payerTextClubInvoice).toBeNull();
    expect(settings.payerTextPerPerson).toBeNull();
  });
});

describe('clubSettingsApi.put', () => {
  it('sends the whole object to the same address and hands back what the server answered', async () => {
    put.mockResolvedValue({ data: { ...BODY, registrationLinkValidityDays: 31 } });
    const answer = await clubSettingsApi.put(BODY);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/clubs', BODY);
    expect(answer.registrationLinkValidityDays).toBe(31);
  });
});

describe('the cache key', () => {
  it('is a "settings" key, which every non-booking write marks stale', () => {
    expect(CLUB_SETTINGS_QUERY_KEY[0]).toBe('settings');
    expect(REFERENCE_KEYS as readonly string[]).toContain('settings');
  });
});
