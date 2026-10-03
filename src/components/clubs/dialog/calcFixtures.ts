/*
 * Test support for the club-block dialog: a stand-in for `POST /club-blocks/calculate`
 * that answers the way the contract says - per činnost, the club as one whole,
 * counting only the minutes inside the windows it is given.
 *
 * Not imported by the app.
 */
import type { BlockAnalysis, Calculation, CalculationInput } from '../../../api/clubBlocks';

export interface FixtureActivity {
  name: string;
  minutesPerSeat: number;
  parallelCapacity: number;
}

export const FIXTURE_ACTIVITIES: Record<string, FixtureActivity> = {
  'a-1': { name: 'Základní prohlídka', minutesPerSeat: 60, parallelCapacity: 2 },
  'a-2': { name: 'Spiroergometrie', minutesPerSeat: 45, parallelCapacity: 1 },
};

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const dayCount = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/** Open minutes of an ordinary day without a window. */
export const OPEN_DAY_MINUTES = 600;

/** The old answer's fields, with a valid analysis computed from the question. */
export function answerFor(input: CalculationInput, over: Partial<Calculation> = {}, analysisOver: Partial<BlockAnalysis> = {}): Calculation {
  const seats = input.activitySeats ?? [];
  const byRange = (input.ranges ?? [{ fromDate: '2026-10-26', toDate: '2026-10-27' }]).map((r) => {
    const window = r.dailyFrom && r.dailyTo ? toMinutes(r.dailyTo) - toMinutes(r.dailyFrom) : OPEN_DAY_MINUTES;
    return {
      fromDate: r.fromDate, toDate: r.toDate, dailyFrom: r.dailyFrom ?? null, dailyTo: r.dailyTo ?? null,
      availableMinutes: dayCount(r.fromDate, r.toDate) * window,
    };
  });
  const availableMinutes = byRange.reduce((n, r) => n + r.availableMinutes, 0);
  const perActivity = seats.map((s) => {
    const a = FIXTURE_ACTIVITIES[s.activityId] ?? { name: s.activityId, minutesPerSeat: 30, parallelCapacity: 1 };
    return {
      activityId: s.activityId,
      name: a.name,
      seats: s.seats,
      minutesPerSeat: a.minutesPerSeat,
      parallelCapacity: a.parallelCapacity,
      neededMinutes: (s.seats * a.minutesPerSeat) / a.parallelCapacity,
      maxSeatsInWindowsAlone: Math.floor((availableMinutes * a.parallelCapacity) / a.minutesPerSeat),
    };
  });
  const totalNeededMinutes = perActivity.reduce((n, a) => n + a.neededMinutes, 0);
  const analysis: BlockAnalysis = {
    totalSeats: seats.reduce((n, s) => n + s.seats, 0),
    perActivity,
    totalNeededMinutes,
    availableMinutes,
    remainingMinutes: availableMinutes - totalNeededMinutes,
    fits: availableMinutes >= totalNeededMinutes,
    byRange,
    capacityNote: null,
    ...analysisOver,
  };
  return {
    minutesPerPlayer: 60, parallelCapacity: 2, neededMinutes: totalNeededMinutes, dailyOpenMinutes: OPEN_DAY_MINUTES,
    suggestedDays: 7, suggestedFrom: '2026-10-26', suggestedTo: '2026-11-03', fitsHorizon: true, minimumPlayers: null, belowMinimum: false,
    perDay: [{ date: '2026-10-26', openMinutes: OPEN_DAY_MINUTES }, { date: '2026-10-27', openMinutes: OPEN_DAY_MINUTES }],
    analysis,
    ...over,
  };
}

/** The answer of a server that does not know the analysis yet. */
export function legacyAnswer(over: Partial<Calculation> = {}): Calculation {
  return {
    minutesPerPlayer: 60, parallelCapacity: 2, neededMinutes: 3600, dailyOpenMinutes: 600,
    suggestedDays: 7, suggestedFrom: '2026-10-26', suggestedTo: '2026-11-03', fitsHorizon: true, minimumPlayers: null, belowMinimum: false,
    perDay: [{ date: '2026-10-26', openMinutes: 600 }, { date: '2026-10-27', openMinutes: 600 }], analysis: null, ...over,
  };
}
