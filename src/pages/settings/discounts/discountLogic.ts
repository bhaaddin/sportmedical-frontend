/*
 * The rules of the discounts screen, away from the screen: how a half-typed row
 * is read, what makes a row wrong, what a headcount comes to, and how the
 * server's refusals find their row.
 *
 * Nothing here is a default. The tiers, the percentages and the roles are the
 * server's; this file only checks them and words them.
 */
import type { DiscountSettings, DiscountTier, PackageDiscount, RoleLimit } from '../../../api/discounts';

const NBSP = ' ';

/* ── Drafts: numbers stay text so a half-typed field is allowed ── */

export interface TierRow { key: string; min: string; percent: string }
export interface PackageRow { key: string; activityId: string; percent: string }
export interface RoleRow { key: string; role: string; percent: string }
export interface DiscountDraft { tiers: TierRow[]; packages: PackageRow[]; roles: RoleRow[] }

let seq = 0;
export const nextKey = (): string => `r${(seq += 1)}`;

const asText = (n: number): string => String(n).replace('.', ',');

export function toDraft(settings: DiscountSettings): DiscountDraft {
  return {
    tiers: settings.tiers.map((t) => ({ key: nextKey(), min: asText(t.minPersons), percent: asText(t.percent) })),
    packages: settings.packageDiscounts.map((p) => ({ key: nextKey(), activityId: p.activityId, percent: asText(p.percent) })),
    roles: settings.roleLimits.map((r) => ({ key: nextKey(), role: r.role, percent: asText(r.maxManualPercent) })),
  };
}

/** What would change by saving: the rows' content without their keys. Same text = nothing to save. */
export function signature(draft: DiscountDraft): string {
  return JSON.stringify([
    draft.tiers.map((t) => [t.min.trim(), t.percent.trim()]),
    draft.packages.map((p) => [p.activityId, p.percent.trim()]),
    draft.roles.map((r) => [r.role, r.percent.trim()]),
  ]);
}

/* ── Reading numbers ── */

/** A percentage with at most two decimals, comma or dot; null when it is not one. */
export function parsePercent(text: string): number | null {
  const t = text.replace(/\s/g, '').replace('%', '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseWhole(text: string): number | null {
  const t = text.replace(/\s/g, '');
  return /^\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : null;
}

/** "10 %", "12,5 %" - a non-breaking space before the sign (Czech typography). */
export const formatPercent = (percent: number): string =>
  `${percent.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}${NBSP}%`;

/** "2 200 Kč" with non-breaking spaces. */
export const formatKc = (amount: number): string =>
  `${amount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 }).replace(/\s/g, NBSP)}${NBSP}Kč`;

/** After "pro": 1 osobu, 2-4 osoby, 5 osob. */
export const persons = (n: number): string => `${n}${NBSP}${n === 1 ? 'osobu' : n >= 2 && n <= 4 ? 'osoby' : 'osob'}`;
/** After "od" or inside a range: od 1 osoby, od 4 osob. */
const personsFrom = (n: number): string => `${n}${NBSP}${n === 1 ? 'osoby' : 'osob'}`;

/* ── Validation ── */

export interface RowErrors { min?: string; percent?: string; activity?: string; row?: string }
export interface DiscountErrors {
  tiers: Record<string, RowErrors>;
  packages: Record<string, RowErrors>;
  roles: Record<string, RowErrors>;
  general: string[];
}

export const emptyErrors = (): DiscountErrors => ({ tiers: {}, packages: {}, roles: {}, general: [] });

export const hasErrors = (e: DiscountErrors): boolean =>
  e.general.length > 0 || [e.tiers, e.packages, e.roles].some((group) => Object.values(group).some((r) => Object.keys(r).length > 0));

function percentProblem(text: string): string | undefined {
  const raw = text.replace(/\s/g, '').replace('%', '').replace(',', '.');
  if (raw === '') return 'Zadejte procento.';
  if (/^\d+\.\d{3,}$/.test(raw)) return 'Nejvýše dvě desetinná místa.';
  const n = parsePercent(text);
  if (n === null) return 'Zadejte procento jako číslo, např. 10 nebo 12,5.';
  if (n > 100) return 'Procento je od 0 do 100.';
  return undefined;
}

/** What stops the draft being sent. The server has the last word; this spares the round trip. */
export function validateDraft(draft: DiscountDraft): DiscountErrors {
  const errors = emptyErrors();
  const note = (group: Record<string, RowErrors>, key: string, field: keyof RowErrors, message: string | undefined) => {
    if (message === undefined) return;
    group[key] = { ...group[key], [field]: message };
  };

  const seen = new Map<number, string>();
  for (const row of draft.tiers) {
    const min = parseWhole(row.min);
    if (min === null) note(errors.tiers, row.key, 'min', 'Zadejte celý počet osob.');
    else if (min < 1) note(errors.tiers, row.key, 'min', 'Hladina začíná nejméně od 1 osoby.');
    else if (seen.has(min)) note(errors.tiers, row.key, 'min', 'Tuto hranici už má jiná hladina.');
    else seen.set(min, row.key);
    note(errors.tiers, row.key, 'percent', percentProblem(row.percent));
  }

  const usedActivities = new Set<string>();
  for (const row of draft.packages) {
    if (row.activityId === '') note(errors.packages, row.key, 'activity', 'Vyberte činnost.');
    else if (usedActivities.has(row.activityId)) note(errors.packages, row.key, 'activity', 'Tato činnost už slevu má.');
    else usedActivities.add(row.activityId);
    note(errors.packages, row.key, 'percent', percentProblem(row.percent));
  }

  for (const row of draft.roles) note(errors.roles, row.key, 'percent', percentProblem(row.percent));

  return errors;
}

/* ── The payload ── */

export interface SentKeys { tiers: string[]; packages: string[]; roles: string[] }

/** The settings as the server wants them: numbers, tiers ascending. `keys` says which draft row each entry came from. */
export function toPayload(draft: DiscountDraft): { settings: DiscountSettings; keys: SentKeys } {
  const tiers = draft.tiers
    .map((t) => ({ key: t.key, tier: { minPersons: parseWhole(t.min) as number, percent: parsePercent(t.percent) as number } }))
    .sort((a, b) => a.tier.minPersons - b.tier.minPersons);
  return {
    settings: {
      tiers: tiers.map((t) => t.tier),
      packageDiscounts: draft.packages.map<PackageDiscount>((p) => ({ activityId: p.activityId, percent: parsePercent(p.percent) as number })),
      roleLimits: draft.roles.map<RoleLimit>((r) => ({ role: r.role, maxManualPercent: parsePercent(r.percent) as number })),
    },
    keys: { tiers: tiers.map((t) => t.key), packages: draft.packages.map((p) => p.key), roles: draft.roles.map((r) => r.key) },
  };
}

/**
 * The server answers `errors: { "tiers[1].minPersons": ["…"] }` (any case). Each
 * sentence goes to the row it names; one that names no row is a general one.
 */
export function placeServerErrors(errors: Record<string, string>, keys: SentKeys): DiscountErrors {
  const out = emptyErrors();
  for (const [field, message] of Object.entries(errors)) {
    if (message === '') continue;
    const m = /^(tiers|packageDiscounts|roleLimits)\[(\d+)\](?:\.(\w+))?$/i.exec(field);
    if (m === null) {
      out.general.push(message);
      continue;
    }
    const kind = m[1].toLowerCase();
    const index = Number(m[2]);
    const part = (m[3] ?? '').toLowerCase();
    const group = kind === 'tiers' ? out.tiers : kind === 'packagediscounts' ? out.packages : out.roles;
    const key = (kind === 'tiers' ? keys.tiers : kind === 'packagediscounts' ? keys.packages : keys.roles)[index];
    if (key === undefined) {
      out.general.push(message);
      continue;
    }
    const slot: keyof RowErrors =
      part === 'minpersons' ? 'min' : part === 'percent' || part === 'maxmanualpercent' ? 'percent' : part === 'activityid' ? 'activity' : 'row';
    group[key] = { ...group[key], [slot]: message };
  }
  return out;
}

/* ── The preview ── */

export interface TierRange { from: number; to: number | null; percent: number }

/** The valid tiers of the draft, ascending, each with the range of heads it covers. */
export function tierRanges(draft: DiscountDraft): TierRange[] {
  const valid = draft.tiers
    .map((t) => ({ min: parseWhole(t.min), percent: parsePercent(t.percent) }))
    .filter((t): t is { min: number; percent: number } => t.min !== null && t.min >= 1 && t.percent !== null && t.percent <= 100)
    .sort((a, b) => a.min - b.min)
    .filter((t, i, all) => i === 0 || t.min !== all[i - 1].min);
  return valid.map((t, i) => ({ from: t.min, to: i + 1 < valid.length ? valid[i + 1].min - 1 : null, percent: t.percent }));
}

/** The tier a group of `headcount` falls into, or null when it is below the first one. */
export const rangeFor = (ranges: readonly TierRange[], headcount: number): TierRange | null =>
  ranges.find((r) => headcount >= r.from && (r.to === null || headcount <= r.to)) ?? null;

export function rangeText(range: TierRange): string {
  if (range.to === null) return `od ${personsFrom(range.from)}`;
  if (range.to === range.from) return personsFrom(range.from);
  return `${range.from}–${personsFrom(range.to)}`;
}

/** "Pro 6 osob platí 10 %." - the sentence under the table, for the headcount typed in the preview. */
export function headcountSentence(ranges: readonly TierRange[], headcount: number): string {
  const range = rangeFor(ranges, headcount);
  if (range === null) {
    return ranges.length === 0
      ? 'Bez hladin se skupinová sleva podle počtu osob neuplatní.'
      : `Pro ${persons(headcount)} se sleva podle počtu osob neuplatní — první hladina začíná od ${personsFrom(ranges[0].from)}.`;
  }
  return `Pro ${persons(headcount)} platí ${formatPercent(range.percent)}.`;
}

/** The headcount the preview opens with: the second tier's start when there is one, else the first's. Nothing invented. */
export function initialHeadcount(ranges: readonly TierRange[]): string {
  const pick = ranges[1] ?? ranges[0];
  return pick === undefined ? '' : String(pick.from);
}

export interface PricedActivity { name: string; priceCzk: number | null; isActive: boolean }

/** The dearest priced činnost on offer - the one a team books by the dozen. */
export function dearestPriced<T extends PricedActivity>(activities: readonly T[]): T | null {
  let best: T | null = null;
  for (const a of activities) {
    if (!a.isActive || a.priceCzk === null) continue;
    if (best === null || (best.priceCzk ?? 0) < a.priceCzk) best = a;
  }
  return best;
}

export function exampleLine(range: TierRange | null, headcount: number, unitPrice: number): { subtotal: number; discount: number; total: number } {
  const subtotal = unitPrice * headcount;
  const discount = range === null ? 0 : Math.round((subtotal * range.percent) / 100);
  return { subtotal, discount, total: subtotal - discount };
}

/* ── Roles ── */

const ROLE_LABELS: Record<string, string> = {
  reception: 'Recepce', receptionist: 'Recepce', recepce: 'Recepce',
  doctor: 'Lékař', physician: 'Lékař', lekar: 'Lékař', 'lékař': 'Lékař',
  admin: 'Admin', administrator: 'Admin',
  staff: 'Personál', personal: 'Personál',
  owner: 'Vlastník', vlastnik: 'Vlastník', 'vlastník': 'Vlastník',
};

/** The role as the screen says it; a role the screen does not know keeps the server's own word. */
export const roleLabel = (role: string): string => ROLE_LABELS[role.trim().toLowerCase()] ?? role;

/** The owner is unlimited by rule: shown, never edited. */
export const isOwnerRole = (role: string): boolean => ['owner', 'vlastnik', 'vlastník'].includes(role.trim().toLowerCase());
