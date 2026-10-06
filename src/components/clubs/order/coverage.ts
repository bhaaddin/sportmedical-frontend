/*
 * The one calculator of "výběr termínů": how much calendar time a club order needs, how much of it the picked
 * ranges already give, and what is still missing. Pure - no React, no network, nothing about a clinic.
 *
 * The same formula as the server's club-block `analysis`: per činnost, seats x minutes per seat / parallelCapacity,
 * pooled over all the calendars (every picked minute counts, whichever calendar it lies in). The server's own
 * answer stays the authority; the calendar shows it beside this one when the two differ.
 */

export interface CoverageActivity {
  activityId: string;
  name: string;
  seats: number;
  minutesPerSeat: number;
  /** How many seats of the činnost run at the same time; at least 1. */
  parallelCapacity: number;
}

export interface ActivityCoverage extends CoverageActivity {
  /** seats x minutesPerSeat / parallelCapacity (not rounded). */
  neededMinutes: number;
  /** The picked minutes this činnost got: činnosti are filled in the order they are listed (see `computeCoverage`). */
  allocatedMinutes: number;
  /** One slot = one visit of the činnost (`minutesPerSeat` long), carrying `parallelCapacity` players. */
  neededSlots: number;
  coveredSlots: number;
  remainingSlots: number;
  coveredSeats: number;
  remainingSeats: number;
  /** Etapa 10: players are expected but no picked window allows this činnost. Only set once something is picked. */
  noWindow: boolean;
}

/** One picked window as the calculator reads it: its minutes and the činnosti it allows (null / absent = all). */
export interface CoverageWindow {
  minutes: number;
  activityIds?: readonly string[] | null;
}

export interface Coverage {
  totalSeats: number;
  /** The total need, rounded UP to a whole minute. */
  neededMinutes: number;
  pickedMinutes: number;
  /** What is still missing (never negative). */
  remainingMinutes: number;
  /** Picked beyond the need (never negative) - the reserve. */
  surplusMinutes: number;
  coveredSeats: number;
  /** The players the picked time does not cover yet. */
  remainingSeats: number;
  /** All slots the order needs, covered so far and still missing - the one number the desk watches. */
  neededSlots: number;
  coveredSlots: number;
  remainingSlots: number;
  /** Everything is covered: there is something to cover and nothing is missing. */
  covered: boolean;
  /** 0-100, whole percent of the need. */
  percent: number;
  perActivity: ActivityCoverage[];
  /**
   * Etapa 10 (enlarging an order): this is the coverage of the ADDITIONAL players only - `pickedMinutes` is the time
   * picked beyond what the order needed before, `neededMinutes` the need of the added players.
   */
  additional?: boolean;
}

const EPS = 1e-9;

export const capacityOf = (a: Pick<CoverageActivity, 'parallelCapacity'>): number =>
  Number.isFinite(a.parallelCapacity) && a.parallelCapacity >= 1 ? a.parallelCapacity : 1;

/** The minutes one činnost needs for its seats, not rounded. */
export const activityNeed = (a: CoverageActivity): number =>
  a.seats > 0 && a.minutesPerSeat > 0 ? (a.seats * a.minutesPerSeat) / capacityOf(a) : 0;

/** The slots one činnost needs: a slot is one visit (its length) and holds `parallelCapacity` players. */
export const activitySlots = (a: CoverageActivity): number =>
  a.seats > 0 && a.minutesPerSeat > 0 ? Math.ceil(a.seats / capacityOf(a) - EPS) : 0;

/**
 * Picked time is one pool of minutes. It is handed to the činnosti IN THE ORDER THEY ARE LISTED: the first one
 * takes whole slots (its length each) until it is covered, what is left goes to the next one, and so on. A rest
 * shorter than the next slot stays unspent (it counts as picked, but not as a slot). So the numbers fall as the
 * desk paints: 12 x 30 min + 10 x 60 min, 330 picked = 11 slots of the first one covered, 1 + 10 still missing.
 *
 * Etapa 10: when a picked window allows only some činnosti (`windows`), minutes are pooled per set of allowed
 * činnosti instead. The most restricted sets are served first (a spiro-only window is not starved by a window that
 * allows everything), each set fills its allowed činnosti in the listed order, and a činnost that no window allows
 * is flagged `noWindow`. With no restricted window the result is exactly the one above.
 */
export function computeCoverage(
  activities: readonly CoverageActivity[],
  pickedMinutes: number,
  windows?: readonly CoverageWindow[],
): Coverage {
  const picked = Math.max(0, Math.floor(Number.isFinite(pickedMinutes) ? pickedMinutes : 0));
  const needs = activities.map(activityNeed);
  const rawNeed = needs.reduce((n, v) => n + v, 0);
  const needed = Math.max(0, Math.ceil(rawNeed - EPS));
  const totalSeats = activities.reduce((n, a) => n + Math.max(0, a.seats), 0);
  const unrestrictedCovered = totalSeats > 0 && needed > 0 && picked >= needed;

  const wanted = activities.filter((a) => activitySlots(a) > 0 && a.minutesPerSeat > 0).map((a) => a.activityId);
  const allowedOf = (w: CoverageWindow): Set<string> | null => {
    if (w.activityIds === null || w.activityIds === undefined || w.activityIds.length === 0) return null;
    const known = wanted.filter((id) => w.activityIds?.includes(id));
    return known.length === 0 || known.length >= wanted.length ? null : new Set(known);
  };
  const restricted = windows !== undefined && windows.some((w) => allowedOf(w) !== null);

  /* Slots covered per činnost: pooled in listed order, or per set of allowed činnosti when the desk restricted windows. */
  const coveredBy = new Map<string, number>();
  if (restricted) {
    const groups = new Map<string, { minutes: number; ids: Set<string> }>();
    for (const w of windows ?? []) {
      const ids = allowedOf(w) ?? new Set(wanted);
      const key = [...ids].sort().join(',');
      const g = groups.get(key) ?? { minutes: 0, ids };
      g.minutes += Math.max(0, w.minutes);
      groups.set(key, g);
    }
    const firstIndex = (g: { ids: Set<string> }) => Math.min(...activities.map((a, i) => (g.ids.has(a.activityId) ? i : Number.POSITIVE_INFINITY)));
    const ordered = [...groups.values()].sort((a, b) => a.ids.size - b.ids.size || firstIndex(a) - firstIndex(b));
    for (const g of ordered) {
      let pool = g.minutes;
      for (const a of activities) {
        if (!g.ids.has(a.activityId) || a.minutesPerSeat <= 0) continue;
        const open = activitySlots(a) - (coveredBy.get(a.activityId) ?? 0);
        const take = Math.max(0, Math.min(open, Math.floor(pool / a.minutesPerSeat + EPS)));
        coveredBy.set(a.activityId, (coveredBy.get(a.activityId) ?? 0) + take);
        pool = Math.max(0, pool - take * a.minutesPerSeat);
      }
    }
  }
  const covered = restricted
    ? totalSeats > 0 && needed > 0 && activities.every((a) => activitySlots(a) - (coveredBy.get(a.activityId) ?? 0) <= 0)
    : unrestrictedCovered;

  let pool = picked;
  const perActivity: ActivityCoverage[] = activities.map((a, i) => {
    const seats = Math.max(0, a.seats);
    const neededSlots = activitySlots(a);
    const slotMinutes = a.minutesPerSeat > 0 ? a.minutesPerSeat : 0;
    /* Everything is covered once the pooled minutes reach the need, even when the slot rounding says otherwise. */
    const coveredSlots = restricted
      ? Math.min(neededSlots, coveredBy.get(a.activityId) ?? 0)
      : covered ? neededSlots : slotMinutes > 0 ? Math.min(neededSlots, Math.floor(pool / slotMinutes + EPS)) : 0;
    const used = coveredSlots * slotMinutes;
    pool = Math.max(0, pool - used);
    const coveredSeats = covered ? seats : Math.min(seats, coveredSlots * capacityOf(a));
    const noWindow =
      windows !== undefined && windows.length > 0 && neededSlots > 0 && !windows.some((w) => w.activityIds == null || w.activityIds.length === 0 || w.activityIds.includes(a.activityId));
    return {
      ...a,
      neededMinutes: needs[i],
      allocatedMinutes: used,
      neededSlots,
      coveredSlots,
      remainingSlots: neededSlots - coveredSlots,
      coveredSeats,
      remainingSeats: seats - coveredSeats,
      noWindow,
    };
  });

  const sum = (pick: (a: ActivityCoverage) => number) => perActivity.reduce((n, a) => n + pick(a), 0);
  return {
    totalSeats,
    neededMinutes: needed,
    pickedMinutes: picked,
    remainingMinutes: Math.max(0, needed - picked),
    surplusMinutes: Math.max(0, picked - needed),
    coveredSeats: sum((a) => a.coveredSeats),
    remainingSeats: totalSeats - sum((a) => a.coveredSeats),
    neededSlots: sum((a) => a.neededSlots),
    coveredSlots: sum((a) => a.coveredSlots),
    remainingSlots: sum((a) => a.remainingSlots),
    covered,
    percent: restricted
      ? covered ? 100 : needed > 0 ? Math.min(99, Math.floor((sum((a) => a.allocatedMinutes) / needed) * 100 + 1e-9)) : 0
      : needed > 0 ? Math.min(100, Math.floor((picked / needed) * 100 + 1e-9)) : 0,
    perActivity,
  };
}

/**
 * Etapa 10 (enlarging an order): the coverage of the ADDITIONAL players only, or null when nobody was added.
 * `baseline` is the order as saved. Without restricted windows the time picked beyond the saved need is handed to the
 * added players' slots (7 more players of a 10-minute činnost = 7 slots of 10 min). With restricted windows each činnost's
 * remaining slots are compared with what the saved order already lacked, so only what the added players cost is shown.
 */
export function computeAdditionalCoverage(
  activities: readonly CoverageActivity[],
  baseline: readonly CoverageActivity[],
  pickedMinutes: number,
  windows?: readonly CoverageWindow[],
): Coverage | null {
  const delta = activities
    .map((a) => ({ ...a, seats: Math.max(0, a.seats - (baseline.find((b) => b.activityId === a.activityId)?.seats ?? 0)) }))
    .filter((a) => a.seats > 0);
  if (delta.length === 0) return null;
  const restricted = windows !== undefined && windows.some((w) => w.activityIds != null && w.activityIds.length > 0);
  if (!restricted) {
    const oldNeed = computeCoverage(baseline, 0).neededMinutes;
    if (pickedMinutes < oldNeed) return null;
    return { ...computeCoverage(delta, pickedMinutes - oldNeed), additional: true };
  }
  const oldCov = computeCoverage(baseline, pickedMinutes, windows);
  const newCov = computeCoverage(activities, pickedMinutes, windows);
  const perActivity = delta.map((d): ActivityCoverage => {
    const now = newCov.perActivity.find((a) => a.activityId === d.activityId);
    const was = oldCov.perActivity.find((a) => a.activityId === d.activityId);
    const neededSlots = activitySlots(d);
    const remainingSlots = Math.min(neededSlots, Math.max(0, (now?.remainingSlots ?? neededSlots) - (was?.remainingSlots ?? 0)));
    const coveredSlots = neededSlots - remainingSlots;
    const coveredSeats = Math.min(d.seats, coveredSlots * capacityOf(d));
    return {
      ...d,
      neededMinutes: activityNeed(d),
      allocatedMinutes: coveredSlots * Math.max(0, d.minutesPerSeat),
      neededSlots,
      coveredSlots,
      remainingSlots,
      coveredSeats,
      remainingSeats: d.seats - coveredSeats,
      noWindow: now?.noWindow ?? false,
    };
  });
  const sum = (pick: (a: ActivityCoverage) => number) => perActivity.reduce((n, a) => n + pick(a), 0);
  const needed = Math.max(0, Math.ceil(delta.reduce((n, a) => n + activityNeed(a), 0) - EPS));
  const remainingSlots = sum((a) => a.remainingSlots);
  const covered = remainingSlots === 0;
  const picked = Math.min(needed, Math.floor(sum((a) => a.allocatedMinutes)));
  return {
    totalSeats: sum((a) => a.seats),
    neededMinutes: needed,
    pickedMinutes: picked,
    remainingMinutes: Math.max(0, needed - picked),
    surplusMinutes: 0,
    coveredSeats: sum((a) => a.coveredSeats),
    remainingSeats: sum((a) => a.remainingSeats),
    neededSlots: sum((a) => a.neededSlots),
    coveredSlots: sum((a) => a.coveredSlots),
    remainingSlots,
    covered,
    percent: covered ? 100 : needed > 0 ? Math.min(99, Math.floor((picked / needed) * 100 + 1e-9)) : 0,
    perActivity,
    additional: true,
  };
}
