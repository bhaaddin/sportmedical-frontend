/*
 * The block calculator - the panel beside the club-block form.
 *
 * While the operator types, the numbers go to `POST /api/v1/club-blocks/calculate`
 * and the panel says what that means: players × minutes ÷ parallel stations =
 * needed minutes, and how many days of the clinic's open hours that is. The
 * server does the arithmetic (it knows the parallel capacity, the open hours
 * and the booking horizon); this panel only asks, waits for the typing to
 * pause, and draws the answer - never a number of its own.
 *
 * Three things the answer can warn about, none of them blocking:
 *   - fewer players than the clinic's minimum - only when the answer itself says
 *     `belowMinimum` and carries a `minimumPlayers` (no minimum set = no warning);
 *   - the need does not fit the booking horizon ("nevejde se");
 *   - nothing is open on the chosen calendars (zero minutes a day).
 */
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { clubBlocksApi } from '../../api/clubBlocks';
import type { Calculation } from '../../api/clubBlocks';
import { SectionLabel, SoftCard } from '../ui';
import { calculationSentence, coveredMinutes, formatMinutes, formatPlayers, formatWeekdayDayMonth } from './blockLogic';
import type { RangeRow } from './blockLogic';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export const CALCULATOR_DEBOUNCE_MS = 300;

export function BlockCalculator({
  playerCount,
  activityIds,
  calendarIds,
  ranges,
  onApply,
}: {
  /** `null` while the headcount is empty or not a number. */
  playerCount: number | null;
  activityIds: string[];
  calendarIds: string[];
  /**
   * The ranges of the whole booking. The suggestion starts at the first row's
   * day; the open minutes of ALL rows are summed against the one need.
   */
  ranges: Pick<RangeRow, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>[];
  /** Fills the FIRST row. */
  onApply: (from: string, to: string) => void;
}) {
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const fromDate = ranges[0]?.fromDate ?? '';
  const ready = playerCount !== null && activityIds.length > 0 && calendarIds.length > 0;

  const input = useDebounced(
    {
      playerCount,
      activityIds: [...activityIds].sort(),
      calendarIds: [...calendarIds].sort(),
      fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : undefined,
    },
    CALCULATOR_DEBOUNCE_MS,
  );
  const inputReady = input.playerCount !== null && input.activityIds.length > 0 && input.calendarIds.length > 0;

  const query = useQuery({
    queryKey: ['club-block-calculation', input],
    queryFn: () =>
      clubBlocksApi.calculate({
        playerCount: input.playerCount as number,
        activityIds: input.activityIds,
        calendarIds: input.calendarIds,
        fromDate: input.fromDate,
      }),
    enabled: inputReady,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  /* The other rows: one call each, with that row's own first day. */
  const extraFroms = useDebounced(
    [...new Set(ranges.slice(1).map((r) => r.fromDate).filter((d) => isDate(d) && d !== fromDate))].sort().join(','),
    CALCULATOR_DEBOUNCE_MS,
  );
  const extraList = extraFroms === '' ? [] : extraFroms.split(',');
  const extraQueries = useQueries({
    queries: extraList.map((from) => ({
      queryKey: ['club-block-calculation', { ...input, fromDate: from }],
      queryFn: () =>
        clubBlocksApi.calculate({
          playerCount: input.playerCount as number,
          activityIds: input.activityIds,
          calendarIds: input.calendarIds,
          fromDate: from,
        }),
      enabled: inputReady,
      retry: false,
      staleTime: 30_000,
    })),
  });

  const calc: Calculation | undefined = ready ? query.data : undefined;
  const perDayByFrom = new Map<string, Calculation['perDay']>();
  if (calc !== undefined) perDayByFrom.set(fromDate, calc.perDay);
  extraList.forEach((from, i) => {
    const data = extraQueries[i]?.data;
    if (data !== undefined) perDayByFrom.set(from, data.perDay);
  });
  const validRows = ranges.filter((r) => isDate(r.fromDate) && isDate(r.toDate) && r.toDate >= r.fromDate);
  const coverageReady = calc !== undefined && validRows.length > 0 && validRows.every((r) => perDayByFrom.has(r.fromDate));
  const covered = coverageReady ? coveredMinutes(ranges, (i) => perDayByFrom.get(ranges[i].fromDate)) : 0;
  const typing = ready && JSON.stringify(input) !== JSON.stringify({
    playerCount,
    activityIds: [...activityIds].sort(),
    calendarIds: [...calendarIds].sort(),
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : undefined,
  });
  /* The warning is the server's verdict, shown only while a minimum is set. */
  const minimum = calc !== undefined && calc.belowMinimum ? calc.minimumPlayers : null;

  return (
    <SoftCard tone="soft" sx={{ p: 2.25 }} data-testid="block-calculator" aria-live="polite">
      <SectionLabel>Kalkulačka bloku</SectionLabel>

      {!ready ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Zadejte počet hráčů, vyberte činnosti a kalendáře — spočítáme, kolik dní blok potřebuje.
        </Typography>
      ) : query.isError && !typing ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Zkusit znovu</Button>}
        >
          Kalkulačku se nepodařilo načíst. {query.error instanceof Error ? query.error.message : ''}
        </Alert>
      ) : calc === undefined ? (
        <Stack spacing={1} aria-busy="true" aria-label="Počítám">
          <Skeleton variant="rounded" height={22} />
          <Skeleton variant="rounded" height={22} width="70%" />
          <Skeleton variant="rounded" height={72} />
        </Stack>
      ) : (
        <Stack spacing={1.5} sx={{ opacity: typing || query.isFetching ? 0.6 : 1 }}>
          <Typography data-testid="calculation-sentence" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>
            {calculationSentence(playerCount as number, calc)}
          </Typography>

          {!calc.fitsHorizon ? (
            <Alert severity="error" role="alert">
              Nevejde se do období, které lze rezervovat. Snižte počet hráčů, přidejte kalendář nebo činnost s více stanovišti.
            </Alert>
          ) : null}

          {calc.fitsHorizon && calc.dailyOpenMinutes <= 0 ? (
            <Alert severity="warning">Ve vybraných kalendářích není v tomto období nic otevřeno.</Alert>
          ) : null}

          {minimum !== null ? (
            <Alert severity="warning" role="status">
              Méně než minimum {formatPlayers(minimum)} — blok jde vytvořit, ale nemusí se vyplatit.
            </Alert>
          ) : null}

          {coverageReady ? (
            <Alert
              severity={covered >= calc.neededMinutes ? 'success' : 'error'}
              role="note"
              data-testid="coverage"
              data-state={covered >= calc.neededMinutes ? 'enough' : 'short'}
            >
              Vybrané termíny pojmou {formatMinutes(covered)} z potřebných {formatMinutes(calc.neededMinutes)}.
              {covered >= calc.neededMinutes ? '' : ' Přidejte termín nebo prodlužte některý z nich — blok i tak jde vytvořit.'}
            </Alert>
          ) : null}

          {calc.perDay.length > 0 ? (
            <Box>
              <SectionLabel sx={{ mb: 0.5 }}>Otevřeno po dnech</SectionLabel>
              <Box
                component="ul"
                aria-label="Otevřeno po dnech"
                sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 168, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
              >
                {calc.perDay.map((day) => (
                  <Box
                    component="li"
                    key={day.date}
                    sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: 1.5, py: 0.75, fontSize: 13, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
                  >
                    <span>{formatWeekdayDayMonth(day.date)}</span>
                    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: day.openMinutes > 0 ? 'text.primary' : 'text.secondary' }}>
                      {day.openMinutes > 0 ? formatMinutes(day.openMinutes) : 'zavřeno'}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}

          <Button
            variant="contained"
            disabled={calc.suggestedFrom === null || calc.suggestedTo === null}
            onClick={() => {
              if (calc.suggestedFrom !== null && calc.suggestedTo !== null) onApply(calc.suggestedFrom, calc.suggestedTo);
            }}
            sx={{ minHeight: 44, alignSelf: 'flex-start' }}
          >
            Použít návrh
          </Button>
        </Stack>
      )}
    </SoftCard>
  );
}

export default BlockCalculator;
