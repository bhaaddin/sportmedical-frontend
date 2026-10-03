/*
 * The calculation behind the club-block dialog: what the operator typed goes to
 * `POST /api/v1/club-blocks/calculate`, after the typing has paused.
 *
 * The question is the whole club at once - seats per činnost, the chosen
 * calendars and every date range with its own daily window - so the answer's
 * `analysis` counts only the time inside those windows. A činnost whose seats
 * are still empty is asked about with one seat: the minutes per seat, the
 * parallel capacity and the "vejde se max." do not depend on the seats, and the
 * dialog needs them to fill the seats from the selected time. `exact` says
 * whether every činnost really has seats, i.e. whether the totals are the club's.
 *
 * A server that does not know `analysis` answers the old way; `legacy` then
 * turns true and the dialog falls back to the single headcount.
 */
import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { clubBlocksApi } from '../../../api/clubBlocks';
import type { ActivitySeat, Calculation, CalculationInput, CalculationRange } from '../../../api/clubBlocks';
import type { RangeRow } from '../blockLogic';

export const CALCULATOR_DEBOUNCE_MS = 300;

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The ranges the analysis can use: valid days, and a window only when it is a valid one. */
export function calculationRanges(rows: readonly Pick<RangeRow, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>[]): CalculationRange[] {
  return rows
    .filter((r) => DATE.test(r.fromDate) && DATE.test(r.toDate) && r.toDate >= r.fromDate)
    .map((r) => {
      const from = r.dailyFrom.trim();
      const to = r.dailyTo.trim();
      const window = TIME.test(from) && TIME.test(to) && to > from;
      return { fromDate: r.fromDate, toDate: r.toDate, dailyFrom: window ? from : null, dailyTo: window ? to : null };
    });
}

export interface BlockCalculationState {
  /** Something to ask about: a činnost and a calendar are chosen. */
  ready: boolean;
  /** Every činnost has valid seats (the totals are the club's own). */
  exact: boolean;
  /** The pause after typing has not ended, or a call is running. */
  busy: boolean;
  /** The last answer. */
  calc: Calculation | undefined;
  /** The answer had no `analysis`: the server only knows the single headcount. */
  legacy: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export function useBlockCalculation({
  activityIds,
  seats,
  legacyCount,
  calendarIds,
  rows,
}: {
  activityIds: string[];
  /** Per činnost id: valid seats, or null while empty. */
  seats: Record<string, number | null>;
  /** The single headcount, used only against a legacy server. */
  legacyCount: number | null;
  calendarIds: string[];
  rows: readonly RangeRow[];
}): BlockCalculationState {
  const ready = activityIds.length > 0 && calendarIds.length > 0;
  const exact = activityIds.length > 0 && activityIds.every((id) => seats[id] !== null && seats[id] !== undefined);
  const wanted = {
    activitySeats: [...activityIds].sort().map((activityId): ActivitySeat => ({ activityId, seats: seats[activityId] ?? 1 })),
    calendarIds: [...calendarIds].sort(),
    ranges: calculationRanges(rows),
    legacyCount,
  };
  /* Debounce the serialised question: a fresh object every render would never settle. */
  const wantedKey = JSON.stringify(wanted);
  const inputKey = useDebounced(wantedKey, CALCULATOR_DEBOUNCE_MS);
  const typing = inputKey !== wantedKey;
  const input = useMemo(() => JSON.parse(inputKey) as typeof wanted, [inputKey]);

  const query = useQuery({
    queryKey: ['club-block-calculation', input],
    queryFn: () => {
      const sum = input.activitySeats.reduce((n, a) => n + a.seats, 0);
      const body: CalculationInput = {
        activitySeats: input.activitySeats,
        calendarIds: input.calendarIds,
        ranges: input.ranges.length > 0 ? input.ranges : undefined,
        /* Only an older server reads these two; the new one derives them. */
        activityIds: input.activitySeats.map((a) => a.activityId),
        playerCount: input.legacyCount ?? sum,
        fromDate: input.ranges[0]?.fromDate,
      };
      return clubBlocksApi.calculate(body);
    },
    enabled: ready && input.activitySeats.length > 0 && input.calendarIds.length > 0,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const calc = ready ? query.data : undefined;
  return {
    ready,
    exact,
    busy: typing || query.isFetching,
    calc,
    legacy: calc !== undefined && (calc.analysis === undefined || calc.analysis === null),
    isError: ready && query.isError && !typing,
    errorMessage: query.error instanceof Error ? query.error.message : '',
    retry: () => void query.refetch(),
  };
}
