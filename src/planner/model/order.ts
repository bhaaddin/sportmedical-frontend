/*
 * The club order: how much was ordered, how much is planned, the command panel,
 * the carousel cards, the summary experience and the publish / finish dialogs.
 *
 * Port of `plannedFrom`, `plannedOf`, `totals`, `adaptivePendingMinutes`,
 * `updateOrderCommand` (data), `renderPlanningActivities` (data),
 * `synchronizePreviewProgress`, `synchronizeOverviewProgress`,
 * `syncAdaptiveSummary`, `updatePreviewNumbers` (text), `s41Snapshot`,
 * `openSummaryExperience` / `showSummarySheet` (data), `orderDetails`,
 * `finishPlan`, `adaptivePublishDialog`, `adaptiveEmailDraft`,
 * `adaptiveClubFormPreview` (data) and the carousel arithmetic
 * (`updateAdaptiveNav`, `setAdaptivePosition`, `syncCarouselVisibility`).
 *
 * "Planned" here is the club's planned capacity (seats in club terms), never
 * the patients' reservations.
 */
import {
  categoryOrFallback,
  demandOf,
  orderCategoryIds,
  slotMinutesOf,
  sourceFor,
} from './context';
import { addDays, dateOf, printable, timeLeft } from './time';
import type {
  CategoryId,
  ClubProfile,
  ClubProfileField,
  HeaderValue,
  OrderCommandModel,
  OrderRow,
  OrderSnapshot,
  OrderTotals,
  PlannerContext,
  PlannerSession,
} from './types';

/* ------------------------------ planned / totals ------------------------------ */

/**
 * Seats planned for a činnost given a list of sessions (`plannedFrom`).
 *
 *   baselinePlanned
 *   - capacity of every baseline club session of this činnost
 *   + current capacity of those same sessions (if still this činnost, club)
 *   + capacity of every NEW club session of this činnost
 *
 * With `baselinePlanned = 0` and no baseline sessions (the API case) this is
 * simply the sum of the club sessions' capacity for the činnost.
 */
export function plannedFrom(
  ctx: Pick<PlannerContext, 'demands' | 'baselineSessions'>,
  sessions: readonly PlannerSession[],
  categoryId: CategoryId,
): number {
  const base = demandOf(ctx, categoryId);
  if (!base) return 0;
  let value = base.baselinePlanned;
  const baselineIds = new Set(ctx.baselineSessions.map((b) => b.id));
  for (const original of ctx.baselineSessions) {
    if (sourceFor(original) !== 'club') continue;
    const now = sessions.find((e) => e.id === original.id);
    if (original.categoryId === categoryId) value -= original.capacity;
    if (now?.categoryId === categoryId && sourceFor(now) === 'club') value += Number(now.capacity || 0);
  }
  for (const e of sessions) {
    if (!baselineIds.has(e.id) && sourceFor(e) === 'club' && e.categoryId === categoryId) {
      value += Number(e.capacity || 0);
    }
  }
  return Math.max(0, value);
}

/** `plannedOf(type)` on the context's own sessions. */
export const plannedOf = (ctx: PlannerContext, categoryId: CategoryId): number =>
  plannedFrom(ctx, ctx.sessions, categoryId);

/** Seats still missing for a činnost (never negative). */
export const remainingOf = (ctx: PlannerContext, categoryId: CategoryId, sessions: readonly PlannerSession[] = ctx.sessions): number => {
  const d = demandOf(ctx, categoryId);
  return d ? Math.max(0, d.requested - plannedFrom(ctx, sessions, categoryId)) : 0;
};

export function totals(ctx: PlannerContext): OrderTotals {
  const ids = orderCategoryIds(ctx);
  const requested = ids.reduce((n, t) => n + (demandOf(ctx, t)?.requested ?? 0), 0);
  const planned = ids.reduce((n, t) => n + plannedOf(ctx, t), 0);
  return {
    requested,
    planned,
    pending: Math.max(0, requested - planned),
    // The prototype divides by `requested` unguarded (NaN for an empty order); 0 is the sane reading.
    percent: requested ? Math.round((100 * planned) / requested) : 0,
  };
}

/** Minutes of examination still to schedule over the whole order (`adaptivePendingMinutes`). */
export function pendingMinutes(ctx: PlannerContext): number {
  return orderCategoryIds(ctx).reduce(
    (n, t) => n + Math.max(0, (demandOf(ctx, t)?.requested ?? 0) - plannedOf(ctx, t)) * slotMinutesOf(ctx, t),
    0,
  );
}

/** Club terms of the ordered činnosti (the "Termíny" counter). */
export function clubTerms(ctx: PlannerContext): PlannerSession[] {
  const ids = orderCategoryIds(ctx);
  return ctx.sessions.filter((e) => sourceFor(e) === 'club' && ids.includes(e.categoryId));
}

/* ------------------------------ command panel ------------------------------ */

export function orderCommandModel(ctx: PlannerContext): OrderCommandModel {
  const x = totals(ctx);
  const ids = orderCategoryIds(ctx);
  const baselineIds = new Set(ctx.baselineSessions.map((b) => b.id));
  const terms = clubTerms(ctx);
  return {
    percent: x.percent,
    planned: x.planned,
    requested: x.requested,
    remainingText: x.pending ? `${x.pending} osob zbývá naplánovat` : '✓ Požadavek klubu splněn',
    terms: terms.length,
    newSlots: ctx.sessions
      .filter((e) => sourceFor(e) === 'club' && ids.includes(e.categoryId) && !baselineIds.has(e.id))
      .reduce((n, e) => n + Number(e.capacity || 0), 0),
    ready: x.pending === 0,
  };
}

/** "Náhled" of the command panel while a valid drag adds `extra` seats (`synchronizeOverviewProgress`). */
export function previewedOrderCommand(ctx: PlannerContext, extra: number): { percent: number; planned: number; requested: number; remainingText: string } {
  const all = totals(ctx);
  const count = all.planned + extra;
  return {
    percent: Math.round((count / all.requested) * 100),
    planned: count,
    requested: all.requested,
    remainingText: all.pending - extra === 0 ? '✓ Celá objednávka bude splněna' : `Náhled: ${all.pending - extra} osob zbývá`,
  };
}

/* ------------------------------ club header ------------------------------ */

export const HEADER_FIELDS: readonly ClubProfileField[] = [
  'ico', 'dic', 'address', 'leaderName', 'leaderEmail', 'leaderPhone', 'contactName', 'contactEmail', 'contactPhone',
];

/** The nine values of the header strip with the Czech placeholder "Doplnit". */
export function headerValues(profile: ClubProfile): HeaderValue[] {
  return HEADER_FIELDS.map((field) => {
    const value = (profile[field] ?? '').trim();
    return { field, value: value || 'Doplnit', missing: !value, title: value || 'Údaj zatím není vyplněn' };
  });
}

export const clubDisplayName = (profile: Pick<ClubProfile, 'clubName'>): string =>
  profile.clubName?.trim() || 'Doplnit název klubu';

/** True when any contact field other than the name is filled (`hasAnyClubData`). */
export const hasAnyClubData = (profile: ClubProfile): boolean =>
  (Object.entries(profile) as [string, unknown][]).some(
    ([k, v]) => k !== 'clubName' && k !== 'logoUrl' && k !== 'clubId' && k !== 'colorHex' && !!String(v ?? '').trim(),
  );

export const contactReady = (profile: ClubProfile): boolean =>
  Boolean(profile.contactName?.trim() && profile.contactEmail?.trim());

/* ------------------------------ carousel cards ------------------------------ */

export interface PlanCardModel {
  categoryId: CategoryId;
  name: string;
  subtitle: string;
  iconKey: string;
  tone: string;
  planned: number;
  requested: number;
  remaining: number;
  done: boolean;
  /** Ring percent, capped at 100. */
  percent: number;
  /** Seven bars (Mon..Sun of the shown week). */
  chart: { height: number; opacity: number; count: number; date: string }[];
  title: string;
  remainingText: string;
  durationText: string;
  bottomText: string;
  slotMinutes: number;
}

export function planCardModel(ctx: PlannerContext, categoryId: CategoryId, weekStart: string, selectedId: CategoryId | null): PlanCardModel {
  const c = categoryOrFallback(ctx, categoryId);
  const d = demandOf(ctx, categoryId);
  const requested = d?.requested ?? 0;
  const planned = plannedOf(ctx, categoryId);
  const remaining = Math.max(0, requested - planned);
  const done = remaining === 0;
  const percent = Math.min(100, Math.round((planned / requested) * 100));
  const active = selectedId === categoryId;
  const slotMinutes = slotMinutesOf(ctx, categoryId);
  const chart = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const count = ctx.sessions
      .filter((e) => e.date === date && e.categoryId === categoryId && sourceFor(e) === 'club')
      .reduce((n, e) => n + e.capacity, 0);
    const high = Math.min(17, Math.max(3, Math.round(2 + count / 3)));
    return { height: high, opacity: count ? 0.9 : 0.16, count, date };
  });
  return {
    categoryId,
    name: c.name,
    subtitle: c.subtitle ?? '',
    iconKey: c.iconKey,
    tone: c.color,
    planned,
    requested,
    remaining,
    done,
    percent,
    chart,
    title: `${c.name} · ${planned}/${requested} · ${remaining} zbývá`,
    remainingText: done ? '✓ Požadavek splněn' : `Zbývá ${remaining} osob`,
    durationText: `${slotMinutes} min / osoba · ${timeLeft(remaining * slotMinutes)}`,
    bottomText: active ? '✦ VYBRÁNO PRO PLÁNOVÁNÍ' : done ? 'HOTOVO' : 'KLIKNUTÍM VYBRAT',
    slotMinutes,
  };
}

/** Card figures while a drag would add `extra` seats (`synchronizePreviewProgress`). */
export function previewedCardFigures(ctx: PlannerContext, categoryId: CategoryId, extra: number) {
  const d = demandOf(ctx, categoryId);
  const requested = d?.requested ?? 0;
  const slotMinutes = slotMinutesOf(ctx, categoryId);
  const after = plannedOf(ctx, categoryId) + extra;
  const percent = Math.round((after / requested) * 100);
  return {
    after,
    requested,
    percent,
    ringPercent: Math.min(100, percent),
    previewing: extra > 0,
    willComplete: extra > 0 && after >= requested,
    remainingText: after === requested ? '✓ Tímto naplníte požadavek' : `Zbývá ${requested - after} osob`,
    durationText: `${slotMinutes} min / osoba · ${timeLeft((requested - after) * slotMinutes)}`,
    bottomText: extra ? `✦ NÁHLED +${extra} ${extra === 1 ? 'OSOBA' : 'OSOB'}` : '✦ VYBRÁNO PRO PLÁNOVÁNÍ',
  };
}

/** The strip above the board: what the desk is planning right now (`#active-plan-hint`). */
export function activePlanHint(
  ctx: PlannerContext,
  selected: CategoryId | null,
  dragging?: { quantity: number; isLimit: boolean } | null,
): { active: boolean; dragging: boolean; parts: string[]; tail: string } {
  if (!selected) {
    return { active: false, dragging: false, parts: ['Vyberte činnost'], tail: 'Žádná činnost není vybraná' };
  }
  const c = categoryOrFallback(ctx, selected);
  const slot = slotMinutesOf(ctx, selected);
  const requested = demandOf(ctx, selected)?.requested ?? 0;
  const planned = plannedOf(ctx, selected);
  if (dragging && dragging.quantity > 0) {
    const add = dragging.quantity;
    return {
      active: true,
      dragging: true,
      parts: [
        `NÁHLED: ${c.name}`,
        `+${add} ${add === 1 ? 'osoba' : 'osob'} · ${timeLeft(add * slot)}`,
        `${planned} → ${planned + add} / ${requested}`,
      ],
      tail: dragging.isLimit ? 'MAXIMUM' : 'UPUŠTĚNÍM VYTVOŘÍTE',
    };
  }
  return {
    active: true,
    dragging: false,
    parts: [`Právě plánujete: ${c.name}`, `${slot} min / osoba · zbývá ${requested - planned} osob`],
    tail: 'ESC ukončit výběr',
  };
}

/* ------------------------------ summary card / experience ------------------------------ */

export function orderSnapshot(ctx: PlannerContext, profile: ClubProfile): OrderSnapshot {
  const ids = orderCategoryIds(ctx);
  const t = totals(ctx);
  const terms = clubTerms(ctx);
  const slots = terms.reduce((sum, e) => sum + Number(e.capacity || 0), 0);
  const rows: OrderRow[] = ids.map((categoryId) => {
    const d = demandOf(ctx, categoryId);
    const requested = d?.requested ?? 0;
    const planned = Math.max(0, plannedOf(ctx, categoryId));
    const percent = requested > 0 ? Math.round((100 * planned) / requested) : 0;
    const c = categoryOrFallback(ctx, categoryId);
    return {
      categoryId,
      name: c.name,
      requested,
      planned,
      remaining: Math.max(0, requested - planned),
      percent: Math.max(0, Math.min(100, percent)),
      slotMinutes: slotMinutesOf(ctx, categoryId),
      color: c.color,
    };
  });
  const ready = contactReady(profile);
  const fullyPlanned = t.pending === 0;
  const planExists = terms.length > 0;
  const issues: string[] = [];
  if (!fullyPlanned) issues.push(`${t.pending} osob ještě není naplánováno`);
  if (!ready) issues.push('Chybí kontakt klubu');
  if (!planExists) issues.push('Zatím nebyl vytvořen klubový termín');
  return { totals: t, terms, slots, pendingMinutes: pendingMinutes(ctx), rows, contactReady: ready, fullyPlanned, planExists, issues };
}

/** Summary card / ring while a valid drag adds `add` seats (`syncAdaptiveSummary`). */
export function previewedSummary(ctx: PlannerContext, add: number, previewType: CategoryId | null) {
  const x = totals(ctx);
  const planned = Math.min(x.requested, x.planned + add);
  const percent = Math.round((100 * planned) / x.requested);
  let remainingTime = pendingMinutes(ctx);
  if (add > 0 && previewType && demandOf(ctx, previewType)) {
    remainingTime = Math.max(0, remainingTime - add * slotMinutesOf(ctx, previewType));
  }
  const bars = orderCategoryIds(ctx).map((categoryId) => {
    const d = demandOf(ctx, categoryId);
    const amount = plannedOf(ctx, categoryId) + (previewType === categoryId ? add : 0);
    const fill = d ? Math.max(0, Math.min(100, Math.round((100 * amount) / d.requested))) : 0;
    return { categoryId, percent: fill };
  });
  return {
    planned,
    requested: x.requested,
    percent,
    remaining: Math.max(0, x.requested - planned),
    remainingTime: timeLeft(remainingTime),
    previewChip: add > 0 ? `  +${add} náhled` : '',
    bars,
  };
}

export interface SummaryExperienceModel {
  snapshot: OrderSnapshot;
  /** "PŘIPRAVENO" | "V PRŮBĚHU" */
  status: 'PŘIPRAVENO' | 'V PRŮBĚHU';
  readiness: string;
  /** First four rows shown as bars on the main panel. */
  topRows: OrderRow[];
}

export function summaryExperienceModel(ctx: PlannerContext, profile: ClubProfile): SummaryExperienceModel {
  const snapshot = orderSnapshot(ctx, profile);
  const { fullyPlanned, contactReady: cr, planExists, issues } = snapshot;
  return {
    snapshot,
    status: fullyPlanned && cr && planExists ? 'PŘIPRAVENO' : 'V PRŮBĚHU',
    readiness: issues.length ? issues.slice(0, 2).join(' · ') : 'Všechny požadované kapacity a kontakty jsou připraveny ke kontrole',
    topRows: snapshot.rows.slice(0, 4),
  };
}

export function summaryDetailLine(row: OrderRow): string {
  return `${row.percent}% naplánováno · zbývá ${row.remaining} osob · ${timeLeft(row.remaining * row.slotMinutes)} vyšetření`;
}

/** Terms of the "Termíny" sheet sorted by date + start. */
export function summaryTermRows(snapshot: OrderSnapshot, ctx: PlannerContext) {
  return [...snapshot.terms]
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .map((e) => ({
      id: e.id,
      name: categoryOrFallback(ctx, e.categoryId).name,
      meta: `${e.date} · ${e.start}–${e.end}`,
      capacityLabel: `${Number(e.capacity || 0)} slotů`,
    }));
}

/* ------------------------------ dialogs ------------------------------ */

export interface OrderDetailsRow {
  categoryId: CategoryId;
  name: string;
  tone: string;
  planned: number;
  requested: number;
  remaining: number;
  percent: number;
  subline: string;
  /** "Plánovat →" is disabled when nothing is left. */
  canPlan: boolean;
}

export function orderDetailsModel(ctx: PlannerContext) {
  const t = totals(ctx);
  const rows: OrderDetailsRow[] = orderCategoryIds(ctx).map((categoryId) => {
    const c = categoryOrFallback(ctx, categoryId);
    const requested = demandOf(ctx, categoryId)?.requested ?? 0;
    const p = plannedOf(ctx, categoryId);
    const remaining = Math.max(0, requested - p);
    const slot = slotMinutesOf(ctx, categoryId);
    return {
      categoryId,
      name: c.name,
      tone: c.color,
      planned: p,
      requested,
      remaining,
      percent: Math.round((100 * p) / requested),
      subline: `${slot} min / osoba · ${remaining ? `zbývá ${remaining} osob (${timeLeft(remaining * slot)})` : '✓ Plně naplánováno'}`,
      canPlan: remaining > 0,
    };
  });
  return { totals: t, rows };
}

export interface FinishPlanModel {
  ready: boolean;
  contactReady: boolean;
  title: string;
  message: string;
  totals: OrderTotals;
  rows: { categoryId: CategoryId; name: string; planned: number; requested: number; complete: boolean }[];
  contactName: string;
  contactEmail: string;
  /** Which primary button the dialog shows. */
  primary: 'confirm' | 'fillContact' | 'continue';
  primaryLabel: string;
}

export function finishPlanModel(ctx: PlannerContext, profile: ClubProfile): FinishPlanModel {
  const all = totals(ctx);
  const ready = all.pending === 0;
  const cr = contactReady(profile);
  // The prototype lists EVERY činnost of the demand table here, not only the visible ones.
  const rows = ctx.demands.map((d) => {
    const planned = plannedOf(ctx, d.categoryId);
    return { categoryId: d.categoryId, name: categoryOrFallback(ctx, d.categoryId).name, planned, requested: d.requested, complete: planned === d.requested };
  });
  const primary = ready && cr ? 'confirm' : ready ? 'fillContact' : 'continue';
  return {
    ready,
    contactReady: cr,
    title: ready ? 'Dokončení plánování' : 'Kontrola rozpracovaného plánu',
    message: ready ? 'Všechny požadované osoby jsou naplánovány.' : `Zbývá naplánovat ${all.pending} osob. Dokončení objednávky zatím není možné.`,
    totals: all,
    rows,
    contactName: profile.contactName || 'nevyplněno',
    contactEmail: profile.contactEmail || 'nevyplněn',
    primary,
    primaryLabel: primary === 'confirm' ? 'Označit plán jako připravený' : primary === 'fillContact' ? 'Doplnit kontakt klubu' : 'Pokračovat v plánování',
  };
}

export interface PublishModel {
  totals: OrderTotals;
  rows: { categoryId: CategoryId; name: string; tone: string; planned: number; requested: number; remainingTime: string }[];
  warning: string | null;
  pendingTime: string;
  recipient: string;
}

export function publishModel(ctx: PlannerContext, profile: ClubProfile): PublishModel {
  const x = totals(ctx);
  const rows = orderCategoryIds(ctx).map((categoryId) => {
    const requested = demandOf(ctx, categoryId)?.requested ?? 0;
    const p = plannedOf(ctx, categoryId);
    const c = categoryOrFallback(ctx, categoryId);
    return {
      categoryId,
      name: c.name,
      tone: c.color,
      planned: p,
      requested,
      remainingTime: timeLeft(Math.max(0, requested - p) * slotMinutesOf(ctx, categoryId)),
    };
  });
  const pendingTime = timeLeft(pendingMinutes(ctx));
  return {
    totals: x,
    rows,
    warning: x.pending
      ? `Zbývá naplánovat ${x.pending} osob (${pendingTime}). Můžete si prohlédnout formulář a připravit koncept, ale úplná objednávka ještě není rozplánována.`
      : null,
    pendingTime,
    recipient: profile.contactEmail || '',
  };
}

/** Plain-text e-mail the club receives; the link is a placeholder until the server exists. */
export function emailDraft(
  ctx: PlannerContext,
  profile: Pick<ClubProfile, 'clubName'>,
  opts: { clinicName: string; link?: string },
): { subject: string; body: string } {
  const x = totals(ctx);
  const link = opts.link ?? '[ZDE BUDE BEZPEČNÝ ODKAZ PO NAPOJENÍ SERVERU]';
  return {
    subject: `${opts.clinicName} · Termíny vyšetření pro ${profile.clubName}`,
    body: `Dobrý den,\n\npřipravili jsme pro ${profile.clubName} termíny sportovních vyšetření.\n\nV klubovém objednávkovém formuláři můžete vybrat termín pro jednotlivé sportovce.\n\nPočet požadovaných osob: ${x.requested}\nAktuálně naplánováno: ${x.planned}\n\nOdkaz na objednávkový formulář:\n${link}\n\nVyplnění je určeno pouze členům vašeho klubu. Nepotvrzené blokace budou podle nastavených podmínek uvolněny veřejnosti před termínem.\n\nS pozdravem\n${opts.clinicName}`,
  };
}

/** Rows of the club form preview: the club's terms of the order, chronological. */
export function formPreviewRows(ctx: PlannerContext) {
  return clubTerms(ctx)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((e) => ({
      id: e.id,
      name: categoryOrFallback(ctx, e.categoryId).name,
      meta: `${printable(dateOf(e.date))} ${e.start}–${e.end} · ${e.capacity} míst`,
    }));
}

/* ------------------------------ carousel arithmetic ------------------------------ */

export interface CarouselModel {
  quantity: number;
  /** CSS class of the deck: `mode-1`, `mode-2`, `mode-scroll`. */
  mode: string;
  showNavigation: boolean;
  showCarousel: boolean;
  rightLimit: number;
  index: number;
  pageStart: number;
  pageEnd: number;
  /** "1–2 / 6" */
  pageLabel: string;
  prevDisabled: boolean;
  nextDisabled: boolean;
  /** One flag per dot: is that card currently in view. */
  dots: boolean[];
}

export function carouselModel(quantity: number, rawIndex: number): CarouselModel {
  const showNavigation = quantity >= 2;
  const showCarousel = quantity >= 3;
  const rightLimit = Math.max(0, quantity - 2);
  const index = Math.min(rawIndex, rightLimit);
  const pageStart = showCarousel ? index + 1 : 1;
  const pageEnd = showCarousel ? Math.min(quantity, index + 2) : Math.min(quantity, 2);
  return {
    quantity,
    mode: quantity < 3 ? `mode-${quantity}` : 'mode-scroll',
    showNavigation,
    showCarousel,
    rightLimit,
    index,
    pageStart,
    pageEnd,
    pageLabel: `${pageStart}–${pageEnd} / ${quantity}`,
    prevDisabled: !showCarousel || index === 0,
    nextDisabled: !showCarousel || index === rightLimit,
    dots: Array.from({ length: quantity }, (_, i) => i >= index && i < index + 2),
  };
}

/** `setAdaptivePosition`: clamp a requested page to 0 … quantity-2; no paging under three cards. */
export function clampCarouselIndex(quantity: number, index: number): number {
  if (quantity < 3) return 0;
  return Math.max(0, Math.min(quantity - 2, index));
}

/** Card opacity for the scroll-synchronised fade (`syncCarouselVisibility`). */
export function cardVisibility(
  card: { left: number; right: number },
  viewport: { left: number; right: number },
): { opacity: number; outside: boolean } {
  const contentLeft = viewport.left + 13;
  const contentRight = viewport.right - 13;
  const overlap = Math.max(0, Math.min(card.right, contentRight) - Math.max(card.left, contentLeft));
  const outside = overlap < 0.5;
  return { opacity: outside ? 0 : Number(Math.min(1, overlap / 38).toFixed(3)), outside };
}

/** Drag end: snap to the nearest page (`finishActivityDrag`). */
export function snapCarouselIndex(scrollLeft: number, startLeft: number, step: number, cancelled: boolean): number {
  if (!step) return 0;
  return Math.round((cancelled ? startLeft : scrollLeft) / step);
}
