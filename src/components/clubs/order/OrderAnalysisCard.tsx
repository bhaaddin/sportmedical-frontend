/*
 * The live analysis beside the form: the club as one whole ("Klub celkem: 70 míst"), the minutes the
 * činnosti need against the minutes the terms give, and a fits / short sentence per činnost. It informs;
 * it never blocks a save.
 */
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { OrderPriceQuote, PaymentMethod } from '../../../api/clubOrders';
import { PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import { SectionLabel, SoftCard } from '../../ui';
import { formatMinutes, plural } from '../blockLogic';
import { formatCzk } from './orderFormat';

export interface AnalysisLike {
  totalSeats: number;
  totalNeededMinutes: number;
  availableMinutes: number;
  remainingMinutes: number;
  fits: boolean;
  capacityNote?: string | null;
  perActivity: { activityId: string; name: string; seats: number; minutesPerSeat: number; neededMinutes: number; maxSeatsInWindowsAlone: number }[];
}

export function OrderAnalysisCard({
  totalSeats, analysis, busy, failed, onRetry, quote, paymentMethod, waiting,
}: {
  totalSeats: number;
  analysis: AnalysisLike | null;
  busy: boolean;
  failed: boolean;
  onRetry: () => void;
  quote: OrderPriceQuote | null;
  paymentMethod: PaymentMethod | null;
  /** Nothing to ask about yet (no service / činnost / calendar). */
  waiting: boolean;
}) {
  return (
    <SoftCard sx={{ p: 2 }} data-testid="order-analysis" data-fits={analysis === null ? undefined : analysis.fits ? 'true' : 'false'}>
      <SectionLabel>Analýza kapacity</SectionLabel>
      <Typography data-testid="club-total" sx={{ fontSize: 17, fontWeight: 700 }}>
        {`Klub celkem: ${totalSeats.toLocaleString('cs-CZ')} ${plural(totalSeats, ['místo', 'místa', 'míst'])}`}
      </Typography>
      {failed ? (
        <Alert severity="warning" sx={{ mt: 1 }} action={<Button color="inherit" size="small" onClick={onRetry}>Zkusit znovu</Button>}>
          Kapacitu se nepodařilo spočítat. Uložení to neblokuje.
        </Alert>
      ) : analysis === null ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
          {waiting ? 'Vyberte službu, činnosti a termíny — kapacita se spočítá sama.' : busy ? 'Počítám…' : 'Zatím bez výpočtu.'}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography variant="body2" data-testid="analysis-minutes">
            {`Potřeba ${formatMinutes(analysis.totalNeededMinutes)} · k dispozici ${formatMinutes(analysis.availableMinutes)}`}
          </Typography>
          <Typography
            variant="body2"
            role="status"
            data-testid="analysis-fits"
            sx={{ fontWeight: 700, color: analysis.fits ? 'success.main' : 'warning.main' }}
          >
            {analysis.fits
              ? `Vejde se — zbývá ${formatMinutes(Math.max(0, analysis.remainingMinutes))}.`
              : `Nevejde se — chybí ${formatMinutes(Math.max(0, -analysis.remainingMinutes))}. Prodlužte nebo přidejte termín; uložit lze i tak.`}
          </Typography>
          {analysis.capacityNote ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{analysis.capacityNote}</Typography> : null}
          <Box component="ul" sx={{ m: 0, pl: 2.25 }} data-testid="analysis-activities">
            {analysis.perActivity.map((a) => (
              <li key={a.activityId} data-testid="analysis-activity" data-activity={a.activityId}>
                <Typography variant="body2">
                  {`${a.name}: ${a.seats} × ${a.minutesPerSeat} min = potřeba ${formatMinutes(a.neededMinutes)}`}
                  {a.seats > a.maxSeatsInWindowsAlone ? ` — samotná se vejde max. ${a.maxSeatsInWindowsAlone.toLocaleString('cs-CZ')}` : ''}
                </Typography>
              </li>
            ))}
          </Box>
          {busy ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>Přepočítávám…</Typography> : null}
        </Stack>
      )}

      {quote !== null ? (
        <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }} data-testid="order-quote">
          <PriceLines quote={quote} />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>Cenu přepočítá server po uložení.</Typography>
        </Box>
      ) : null}
      {paymentMethod !== null ? (
        <Typography variant="body2" sx={{ mt: 1 }} data-testid="analysis-payment">{`Platba: ${PAYMENT_METHOD_LABEL[paymentMethod]}`}</Typography>
      ) : null}
    </SoftCard>
  );
}

export function PriceLines({ quote }: { quote: OrderPriceQuote }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">{`Ceník: ${formatCzk(quote.listTotalCzk)}`}</Typography>
      {quote.discounts.map((d, i) => (
        <Typography key={`${d.kind}-${i}`} variant="body2" sx={{ color: 'text.secondary' }}>
          {`${d.label}${d.percent ? ` (${d.percent} %)` : ''}: −${formatCzk(Math.abs(d.amountCzk))}`}
        </Typography>
      ))}
      <Typography sx={{ fontSize: 15, fontWeight: 700 }} data-testid="quote-total">{`Celkem: ${formatCzk(quote.totalCzk)}`}</Typography>
    </Stack>
  );
}
