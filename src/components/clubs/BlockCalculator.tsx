/*
 * The block analysis - the panel beside the club-block form.
 *
 * The club is counted as one whole. While the operator types, the seats per
 * činnost, the calendars and the date ranges (each with its own daily window)
 * go to `POST /api/v1/club-blocks/calculate` - see `dialog/useBlockCalculation`
 * for the asking, the debounce and the cancelling - and this panel draws the
 * answer: per činnost "10 hráčů × 30 min = 300 min", the club's total against
 * the time available inside the chosen windows, the time per range, and the
 * server's `capacityNote` as a hint. The server does all the arithmetic; the
 * panel never invents a number of its own.
 *
 * Warnings, none of them blocking:
 *   - the need is bigger than the time available ("chybí N min");
 *   - the need does not fit the booking horizon ("nevejde se");
 *   - nothing is open on the chosen calendars;
 *   - fewer players than the clinic's minimum - only when the answer itself says
 *     `belowMinimum` and carries a `minimumPlayers`.
 *
 * Against a server that answers without `analysis` the old calculator body is
 * drawn instead: one headcount × minutes ÷ stations = minutes, and the days.
 */
import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import type { BlockAnalysis } from '../../api/clubBlocks';
import { SectionLabel, SoftCard } from '../ui';
import { calculationSentence, formatMinutes, formatPlayers, formatShortSpan, formatWeekdayDayMonth, plural, windowLabel } from './blockLogic';
import type { BlockCalculationState } from './dialog/useBlockCalculation';

export { CALCULATOR_DEBOUNCE_MS } from './dialog/useBlockCalculation';

export function BlockCalculator({
  state,
  legacyPlayers,
  onApply,
}: {
  state: BlockCalculationState;
  /** The single headcount, for the legacy sentence only. */
  legacyPlayers: number | null;
  /** Fills the FIRST row. */
  onApply: (from: string, to: string) => void;
}) {
  const { calc, ready, exact, busy } = state;
  const analysis = calc?.analysis ?? null;

  return (
    <SoftCard tone="soft" sx={{ p: 2.25 }} data-testid="block-calculator" aria-live="polite">
      <SectionLabel>Analýza bloku</SectionLabel>

      {!ready ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vyberte kalendář a činnosti a zadejte místa pro klub — spočítáme, jestli se vejdou do vybraných termínů.
        </Typography>
      ) : state.isError ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={state.retry}>Zkusit znovu</Button>}
        >
          Kalkulačku se nepodařilo načíst. {state.errorMessage}
        </Alert>
      ) : calc === undefined ? (
        <Stack spacing={1} aria-busy="true" aria-label="Počítám">
          <Skeleton variant="rounded" height={22} />
          <Skeleton variant="rounded" height={22} width="70%" />
          <Skeleton variant="rounded" height={72} />
        </Stack>
      ) : !exact && !state.legacy ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Zadejte počet hráčů u každé vybrané činnosti — pak se tu ukáže, jestli se klub vejde do vybraných termínů.
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ opacity: busy ? 0.6 : 1 }}>
          {analysis !== null ? <AnalysisBody analysis={analysis} /> : null}
          {state.legacy ? (
            <Typography data-testid="calculation-sentence" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>
              {calculationSentence(legacyPlayers ?? 0, calc)}
            </Typography>
          ) : null}

          {!calc.fitsHorizon ? (
            <Alert severity="error" role="alert" data-testid="horizon-warning">
              Nevejde se do období, které lze rezervovat. Snižte počet hráčů, přidejte kalendář nebo činnost s více stanovišti.
            </Alert>
          ) : null}

          {calc.fitsHorizon && calc.dailyOpenMinutes <= 0 && state.legacy ? (
            <Alert severity="warning">Ve vybraných kalendářích není v tomto období nic otevřeno.</Alert>
          ) : null}

          {calc.belowMinimum && calc.minimumPlayers !== null ? (
            <Alert severity="warning" role="status">
              Méně než minimum {formatPlayers(calc.minimumPlayers)} — blok jde vytvořit, ale nemusí se vyplatit.
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

function AnalysisBody({ analysis }: { analysis: BlockAnalysis }) {
  const short = analysis.remainingMinutes < 0;
  const seatsWord = plural(analysis.totalSeats, ['místo', 'místa', 'míst']);
  return (
    <>
      <Box component="ul" aria-label="Činnosti klubu" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {analysis.perActivity.map((a) => (
          <Box component="li" key={a.activityId} data-testid="analysis-activity" sx={{ fontSize: 14, lineHeight: 1.5, py: 0.25 }}>
            <strong>{a.name}</strong>
            {` · ${formatPlayers(a.seats)} × ${formatMinutes(a.minutesPerSeat)}`}
            {a.parallelCapacity > 1
              ? ` ÷ ${a.parallelCapacity} ${plural(a.parallelCapacity, ['stanoviště', 'stanoviště', 'stanovišť'])}`
              : ''}
            {` = ${formatMinutes(a.neededMinutes)}`}
          </Box>
        ))}
      </Box>

      <Alert
        severity={analysis.fits ? 'success' : 'error'}
        role="note"
        data-testid="analysis-total"
        data-state={analysis.fits ? 'fits' : 'short'}
      >
        {`Klub celkem: ${analysis.totalSeats.toLocaleString('cs-CZ')} ${seatsWord}, potřebuje ${formatMinutes(analysis.totalNeededMinutes)}, k dispozici ve vybraných termínech ${formatMinutes(analysis.availableMinutes)} — ${
          short ? `chybí ${formatMinutes(-analysis.remainingMinutes)}` : `zbývá ${formatMinutes(analysis.remainingMinutes)}`
        }`}
        {analysis.fits ? '' : '. Přidejte termín, prodlužte okno nebo snižte počty — blok i tak jde vytvořit.'}
      </Alert>

      {analysis.byRange.length > 0 ? (
        <Box>
          <SectionLabel sx={{ mb: 0.5 }}>K dispozici po termínech</SectionLabel>
          <Box
            component="ul"
            aria-label="K dispozici po termínech"
            sx={{ listStyle: 'none', m: 0, p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
          >
            {analysis.byRange.map((r, i) => (
              <Box
                component="li"
                key={`${r.fromDate}-${i}`}
                data-testid="analysis-range"
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: 1.5, py: 0.75, fontSize: 13, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
              >
                <span>
                  {formatShortSpan(r.fromDate, r.toDate)}
                  {windowLabel({ dailyFrom: r.dailyFrom ?? '', dailyTo: r.dailyTo ?? '' }) !== null ? ` · ${r.dailyFrom}–${r.dailyTo}` : ''}
                </span>
                <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatMinutes(r.availableMinutes)}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      {analysis.capacityNote !== null ? (
        <Typography variant="caption" data-testid="capacity-note" sx={{ color: 'text.secondary' }}>
          {analysis.capacityNote}
        </Typography>
      ) : null}
    </>
  );
}

export default BlockCalculator;
