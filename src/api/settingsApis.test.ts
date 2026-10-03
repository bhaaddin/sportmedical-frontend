/*
 * The four Etapa 2 settings modules: which address they talk to, what they send,
 * and that a short or odd answer reads as empty rather than throwing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('./client', () => ({ client: { get, put }, default: { get, put } }));

import { discountSettingsApi, normalizeDiscountSettings } from './discounts';
import { companySettingsApi, normalizeCompanySettings } from './companySettings';
import { quickRegistrationSettingsApi, normalizeQuickRegistration } from './quickRegistrationSettings';
import { serviceColorsApi, normalizeServiceColors } from './serviceColors';

beforeEach(() => {
  get.mockReset();
  put.mockReset();
});

describe('discounts', () => {
  it('reads the three lists, tiers ascending', async () => {
    get.mockResolvedValue({ data: {
      tiers: [{ minPersons: 10, percent: 15 }, { minPersons: 4, percent: 5 }],
      packageDiscounts: [{ activityId: 'a-1', percent: 8 }],
      roleLimits: [{ role: 'Doctor', maxManualPercent: 10 }],
    } });
    const settings = await discountSettingsApi.get();
    expect(get).toHaveBeenCalledWith('/api/v1/settings/discounts');
    expect(settings.tiers.map((t) => t.minPersons)).toEqual([4, 10]);
    expect(settings.packageDiscounts).toEqual([{ activityId: 'a-1', percent: 8 }]);
    expect(settings.roleLimits).toEqual([{ role: 'Doctor', maxManualPercent: 10 }]);
  });

  it('puts exactly what it is given and reads the answer', async () => {
    const body = { tiers: [{ minPersons: 4, percent: 5 }], packageDiscounts: [], roleLimits: [] };
    put.mockResolvedValue({ data: body });
    expect(await discountSettingsApi.put(body)).toEqual(body);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/discounts', body);
  });

  it('reads a missing or odd answer as empty lists, and the wrapped shape too', () => {
    expect(normalizeDiscountSettings(undefined)).toEqual({ tiers: [], packageDiscounts: [], roleLimits: [] });
    expect(normalizeDiscountSettings({ tiers: 'x', roleLimits: [null, { role: 1 }] }).roleLimits).toEqual([{ role: '', maxManualPercent: 0 }]);
    expect(normalizeDiscountSettings({ settings: { tiers: [{ minPersons: 2, percent: 3 }] } }).tiers).toEqual([{ minPersons: 2, percent: 3 }]);
  });
});

describe('quick registration', () => {
  it('talks to its own address', async () => {
    const body = { expiryHours: 24, reminderHoursBeforeExpiry: 4, requireDateOfBirthOnCompletion: false };
    get.mockResolvedValue({ data: body });
    put.mockResolvedValue({ data: body });
    expect(await quickRegistrationSettingsApi.get()).toEqual(body);
    expect(get).toHaveBeenCalledWith('/api/v1/settings/quick-registration');
    await quickRegistrationSettingsApi.put(body);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/quick-registration', body);
  });

  it('never reads a missing switch as on', () => {
    expect(normalizeQuickRegistration({}).requireDateOfBirthOnCompletion).toBe(false);
    expect(normalizeQuickRegistration({ requireDateOfBirthOnCompletion: 'true' }).requireDateOfBirthOnCompletion).toBe(false);
  });
});

describe('company', () => {
  it('talks to its own address and fills what is missing with empty text', async () => {
    get.mockResolvedValue({ data: { legalName: 'Firma s.r.o.', ico: '12345678', invoiceDueDays: 14 } });
    const company = await companySettingsApi.get();
    expect(get).toHaveBeenCalledWith('/api/v1/settings/company');
    expect(company).toMatchObject({ legalName: 'Firma s.r.o.', ico: '12345678', dic: '', iban: '', dataBox: '', invoiceDueDays: 14 });
    put.mockResolvedValue({ data: company });
    await companySettingsApi.put(company);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/company', company);
  });

  it('reads nothing as an empty company', () => {
    expect(normalizeCompanySettings(null).legalName).toBe('');
    expect(normalizeCompanySettings(null).invoiceDueDays).toBe(0);
  });
});

describe('service colours', () => {
  it('talks to its own address', async () => {
    get.mockResolvedValue({ data: { palette: ['#0D5C52', 3, '#2B3440'] } });
    expect((await serviceColorsApi.get()).palette).toEqual(['#0D5C52', '#2B3440']);
    expect(get).toHaveBeenCalledWith('/api/v1/settings/service-colors');
    put.mockResolvedValue({ data: { palette: ['#0D5C52'] } });
    await serviceColorsApi.put({ palette: ['#0D5C52'] });
    expect(put).toHaveBeenCalledWith('/api/v1/settings/service-colors', { palette: ['#0D5C52'] });
  });

  it('reads no palette as an empty one', () => {
    expect(normalizeServiceColors({})).toEqual({ palette: [] });
  });
});
