import client from './client';
import { toNamedError } from './duplicateName';
import { toInUseError } from './deleteInUse';
import {
  activityListResultSchema,
  activitySaveResultSchema,
  parseResponse,
  type Activity,
  type ActivityInput,
  type ActivityListResult,
  type ActivitySaveResult,
} from './bookingContracts';
import { questionnaireRequirementToWire } from './bookingContracts';
import { priceOf, type PriceItem } from '../components/booking/price/priceOf';
import { servicesApi } from './services';
import { registerActivityIds } from '../colors/defaultActivityColors';

/** The price list, read at most once a minute for the fallback below (a failed read just means no fallback). */
let priceItems: { at: number; items: Promise<PriceItem[]> } | null = null;
const readPriceItems = (): Promise<PriceItem[]> => {
  const now = Date.now();
  if (priceItems === null || now - priceItems.at > 60_000) {
    priceItems = { at: now, items: servicesApi.getAll().catch(() => { priceItems = null; return [] as PriceItem[]; }) };
  }
  return priceItems.items;
};

/** For tests: forget the cached price list. */
export const resetActivityPriceItems = (): void => { priceItems = null; };

/**
 * R8: every active činnost without a price gets the one `priceOf` finds (link, then name). Every screen reads
 * `priceCzk` from this list, so they all agree and none says "bez ceny" for an item the price list prices.
 */
async function withListPrices(result: ActivityListResult): Promise<ActivityListResult> {
  if (!result.activities.some((a) => a.isActive && a.priceCzk === null)) return result;
  const items = await readPriceItems();
  if (items.length === 0) return result;
  return { ...result, activities: result.activities.map((a) => (a.priceCzk === null && a.isActive ? { ...a, priceCzk: priceOf(a, items) } : a)) };
}

/** Activities - booking contract 4.3, screen 5.6. An activity has no break of its own. */

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toNamedError(error);
  }
}

/**
 * The API binds `questionnaireRequirement` from its number (0, 1, 2), not from
 * its name; the screens work with the name. Converted here, once, on the way out.
 */
const toWire = (input: ActivityInput) => ({
  ...input,
  questionnaireRequirement: questionnaireRequirementToWire(input.questionnaireRequirement),
});

/**
 * The input that saves a činnost exactly as it was read, with `patch` on top.
 *
 * `PUT /api/activities/{id}` is the whole činnost: a field left out is cleared.
 * Every screen that changes one thing about a činnost (its colour, its
 * capacity, its required documents) goes through this, so the rest travels back
 * untouched - including the price-list link and the Etapa 2 fields.
 */
export function activityToInput(activity: Activity, patch: Partial<ActivityInput> = {}): ActivityInput {
  return {
    name: activity.name,
    durationMinutes: activity.durationMinutes,
    color: activity.color,
    publicNote: activity.publicNote,
    isPubliclyBookable: activity.isPubliclyBookable,
    requiresReportByEmail: activity.requiresReportByEmail,
    requiresClubSharing: activity.requiresClubSharing,
    questionnaireRequirement: activity.questionnaireRequirement,
    sortOrder: activity.sortOrder,
    serviceItemId: activity.serviceItemId,
    clinicServiceId: activity.clinicServiceId ?? '',
    questionnaireDefinitionId: activity.questionnaireDefinitionId,
    colorHex: activity.colorHex ?? null,
    parallelCapacity: activity.parallelCapacity ?? 1,
    requiredDocumentTemplateIds: activity.requiredDocumentTemplateIds,
    ...patch,
  };
}

/** The list as a screen gets it: parsed, the default colours spread, the list prices filled in (also for the planner screen's copy). */
export async function readActivityList(body: unknown): Promise<ActivityListResult> {
  const parsed = parseResponse(activityListResultSchema, body);
  /* the default činnost colours are spread over the whole list (src/colors/defaultActivityColors.ts) */
  registerActivityIds(parsed.activities.map((a) => a.id));
  return withListPrices(parsed);
}

export const activitiesApi = {
  /** 4.3: the read is symmetric with the write, warnings and all. */
  list: (): Promise<ActivityListResult> =>
    request(async () => {
      const res = await client.get('/api/activities');
      return readActivityList(res.data);
    }),

  /**
   * 5.6: the save may report an unsellable remainder. That is a warning, never
   * a blocking error — an empty `warnings` array is the plain success case.
   */
  create: (input: ActivityInput): Promise<ActivitySaveResult> =>
    request(async () => {
      const res = await client.post('/api/activities', toWire(input));
      return parseResponse(activitySaveResultSchema, res.data);
    }),

  update: (id: string, input: ActivityInput): Promise<ActivitySaveResult> =>
    request(async () => {
      const res = await client.put(`/api/activities/${id}`, toWire(input));
      return parseResponse(activitySaveResultSchema, res.data);
    }),

  /** Etapa 4, D9: this ARCHIVES. The row stays in the list with `isActive: false`; nothing that references it is touched. */
  remove: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/activities/${id}`);
    }),

  /** Physically removes the činnost, only when nothing references it; otherwise rejects with an `InUseError` (409 `activity.in_use`). */
  removePermanently: (id: string): Promise<void> =>
    request(async () => {
      try {
        await client.delete(`/api/activities/${id}`, { params: { permanent: true } });
      } catch (error) {
        throw toInUseError(error) ?? error;
      }
    }),

  /** ...and this is the way back, which the screen owed the owner. */
  restore: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/activities/${id}/restore`, {});
    }),
};

export default activitiesApi;
