/* ══════════════════════════════════════════════════════════════
   Group-discount table — the clinic's own setting.

   A bigger group booked together pays less, by how many people. The bands
   and percentages are entirely the clinic's to set; nothing is hard-coded.

     GET/PUT /api/v1/settings/group-discounts   (read: anyone signed in)

   Writes need settings.clinic.manage; the server refuses overlapping bands
   or a percentage out of range, and sends back its own defaults + limit so
   this screen never keeps a second copy of the rule.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

/** One band: from `minHeadcount` up to `maxHeadcount` (null = open-ended), `percent`% off. */
export interface GroupDiscountTier {
  minHeadcount: number;
  maxHeadcount: number | null;
  percent: number;
}

export interface GroupDiscountSettings {
  tiers: GroupDiscountTier[];
}

export interface GroupDiscountResponse {
  settings: GroupDiscountSettings;
  /** The owner's bands — the screen offers "reset to these", not its own copy. */
  defaults: GroupDiscountSettings;
  maxTiers: number;
}

export const readGroupDiscounts = async (): Promise<GroupDiscountResponse> => {
  const { data } = await client.get<GroupDiscountResponse>('/api/v1/settings/group-discounts');
  return data;
};

export const saveGroupDiscounts = async (
  settings: GroupDiscountSettings,
): Promise<GroupDiscountResponse> => {
  const { data } = await client.put<GroupDiscountResponse>(
    '/api/v1/settings/group-discounts',
    settings,
  );
  return data;
};

export const GROUP_DISCOUNTS_QUERY_KEY = ['settings', 'group-discounts'] as const;
