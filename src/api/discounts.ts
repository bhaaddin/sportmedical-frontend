/* ══════════════════════════════════════════════════════════════
   Discounts — the clinic's own setting (Etapa 2, contract C3).

     GET/PUT /api/v1/settings/discounts
       { tiers:            [{ minPersons, percent }],      ascending, unique
         packageDiscounts: [{ activityId, percent }],      only for package lines
         roleLimits:       [{ role, maxManualPercent }] }  manual discount per role

   Nothing here is a default: the numbers, the percentages and the list of
   roles all come from the server. A tier discount and a club discount do not
   add up (the higher applies); the manual discount is added on top, up to the
   role's limit, and above it the invoice waits for approval.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface DiscountTier {
  minPersons: number;
  percent: number;
}

export interface PackageDiscount {
  activityId: string;
  percent: number;
}

export interface RoleLimit {
  role: string;
  maxManualPercent: number;
}

export interface DiscountSettings {
  tiers: DiscountTier[];
  packageDiscounts: PackageDiscount[];
  roleLimits: RoleLimit[];
}

export const DISCOUNT_SETTINGS_QUERY_KEY = ['settings', 'discounts'] as const;

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object') : [];

/** Whatever the server sent, made into the settings shape; a missing list reads as empty. */
export function normalizeDiscountSettings(raw: unknown): DiscountSettings {
  const body = (raw ?? {}) as Record<string, unknown>;
  const inner = (body.settings !== null && typeof body.settings === 'object' ? body.settings : body) as Record<string, unknown>;
  return {
    tiers: rows(inner.tiers)
      .map((t) => ({ minPersons: num(t.minPersons), percent: num(t.percent) }))
      .sort((a, b) => a.minPersons - b.minPersons),
    packageDiscounts: rows(inner.packageDiscounts).map((p) => ({ activityId: str(p.activityId), percent: num(p.percent) })),
    roleLimits: rows(inner.roleLimits).map((r) => ({ role: str(r.role), maxManualPercent: num(r.maxManualPercent) })),
  };
}

export const discountSettingsApi = {
  get: async (): Promise<DiscountSettings> => {
    const { data } = await client.get('/api/v1/settings/discounts');
    return normalizeDiscountSettings(data);
  },
  put: async (settings: DiscountSettings): Promise<DiscountSettings> => {
    const { data } = await client.put('/api/v1/settings/discounts', settings);
    return normalizeDiscountSettings(data);
  },
};
