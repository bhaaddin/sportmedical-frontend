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
  /** The share of the picked minutes this činnost gets (in proportion to its need). */
  allocatedMinutes: number;
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

export function computeCoverage(activities: readonly CoverageActivity[], pickedMinutes: number): Coverage {
  const picked = Math.max(0, Math.floor(Number.isFinite(pickedMinutes) ? pickedMinutes : 0));
  const needs = activities.map(activityNeed);
  const rawNeed = needs.reduce((n, v) => n + v, 0);
  const needed = Math.max(0, Math.ceil(rawNeed - EPS));
  const totalSeats = activities.reduce((n, a) => n + Math.max(0, a.seats), 0);
  const covered = totalSeats > 0 && needed > 0 && picked >= needed;

  const perActivity: ActivityCoverage[] = activities.map((a, i) => {
    const allocated = rawNeed > 0 ? (picked * needs[i]) / rawNeed : 0;
    const seats = Math.max(0, a.seats);
    const coveredSeats = covered
      ? seats
      : a.minutesPerSeat > 0
        ? Math.min(seats, Math.floor((allocated * capacityOf(a)) / a.minutesPerSeat + EPS))
        : 0;
    return { ...a, neededMinutes: needs[i], allocatedMinutes: allocated, coveredSeats, remainingSeats: seats - coveredSeats };
  });

  const coveredSeats = perActivity.reduce((n, a) => n + a.coveredSeats, 0);
  return {
    totalSeats,
    neededMinutes: needed,
    pickedMinutes: picked,
    remainingMinutes: Math.max(0, needed - picked),
    surplusMinutes: Math.max(0, picked - needed),
    coveredSeats,
    remainingSeats: totalSeats - coveredSeats,
    covered,
    percent: needed > 0 ? Math.min(100, Math.floor((picked / needed) * 100 + EPS)) : 0,
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
