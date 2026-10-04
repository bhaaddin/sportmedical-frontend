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
 */
export function computeCoverage(activities: readonly CoverageActivity[], pickedMinutes: number): Coverage {
  const picked = Math.max(0, Math.floor(Number.isFinite(pickedMinutes) ? pickedMinutes : 0));
  const needs = activities.map(activityNeed);
  const rawNeed = needs.reduce((n, v) => n + v, 0);
  const needed = Math.max(0, Math.ceil(rawNeed - EPS));
  const totalSeats = activities.reduce((n, a) => n + Math.max(0, a.seats), 0);
  const covered = totalSeats > 0 && needed > 0 && picked >= needed;

  let pool = picked;
  const perActivity: ActivityCoverage[] = activities.map((a, i) => {
    const seats = Math.max(0, a.seats);
    const neededSlots = activitySlots(a);
    const slotMinutes = a.minutesPerSeat > 0 ? a.minutesPerSeat : 0;
    /* Everything is covered once the pooled minutes reach the need, even when the slot rounding says otherwise. */
    const coveredSlots = covered ? neededSlots : slotMinutes > 0 ? Math.min(neededSlots, Math.floor(pool / slotMinutes + EPS)) : 0;
    const used = coveredSlots * slotMinutes;
    pool = Math.max(0, pool - used);
    const coveredSeats = covered ? seats : Math.min(seats, coveredSlots * capacityOf(a));
    return {
      ...a,
      neededMinutes: needs[i],
      allocatedMinutes: used,
      neededSlots,
      coveredSlots,
      remainingSlots: neededSlots - coveredSlots,
      coveredSeats,
      remainingSeats: seats - coveredSeats,
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
    percent: needed > 0 ? Math.min(100, Math.floor((picked / needed) * 100 + 1e-9)) : 0,
    perActivity,
  };
}

/**
 * How many more minutes may be picked: what is missing, or without limit when the reserve is allowed.
 * Before anything is typed (nothing to cover) nothing may be picked.
 */
export function pickAllowance(coverage: Coverage, allowReserve: boolean): number {
  if (coverage.neededMinutes <= 0) return 0;
  return allowReserve ? Number.POSITIVE_INFINITY : coverage.remainingMinutes;
}
