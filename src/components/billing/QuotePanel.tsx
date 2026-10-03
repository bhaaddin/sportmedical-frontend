/*
 * What the server says the new document costs: the list total, each discount
 * row, the total - and, when the manual discount is above the caller's limit, a
 * beige notice that the invoice will wait for approval. Nothing is computed
 * here; while a newer question is on its way the old answer is dimmed.
 */
import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import type { PriceQuote } from '../../api/billing';
import { DESIGN, SectionLabel, SoftCard } from '../ui';
import { czk } from '../../pages/billing/money';
import { formatPercent } from '../../pages/billing/invoiceView';
import DiscountRows from './DiscountRows';

export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error';

export const OVER_LIMIT_TEXT = 'Nad limit — faktura půjde ke schválení';

export default function QuotePanel({
  quote,
  status,
  error,
  onRetry,
}: {
  quote: PriceQuote | null;
  status: QuoteStatus;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <SoftCard tone="muted" aria-label="Rozpis ceny" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel sx={{ mb: 1 }}>Rozpis ceny</SectionLabel>
        {status === 'loading' && <CircularProgress size={16} aria-label="Počítám cenu" />}
      </Stack>

      {status === 'error' && (
        <Box role="alert" sx={{ display: 'grid', gap: 1 }}>
          <Typography variant="body2" sx={{ color: DESIGN.tone.red.fg }}>
            {error && error !== '' ? error : 'Cenu se nepodařilo spočítat.'}
          </Typography>
          {onRetry && (
            <Button variant="outlined" size="small" onClick={onRetry} sx={{ alignSelf: 'flex-start' }}>
              Zkusit znovu
            </Button>
          )}
        </Box>
      )}

      {quote === null && status !== 'error' && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vyberte příjemce a činnosti z ceníku — cenu a slevy spočítá server.
        </Typography>
      )}

      {quote !== null && status !== 'error' && (
        <Box sx={{ display: 'grid', gap: 1.25, opacity: status === 'loading' ? 0.55 : 1 }}>
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {quote.lines.map((line) => (
              <Stack key={line.activityId} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2">
                  {line.quantity > 1 ? `${line.quantity}× ` : ''}{line.name}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {czk(line.listTotalCzk)}
                </Typography>
              </Stack>
            ))}
          </Box>
          <Divider />
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Cena podle ceníku</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {czk(quote.listTotalCzk)}
            </Typography>
          </Stack>
          <DiscountRows discounts={quote.discounts} />
          <Divider />
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Celkem k úhradě</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
              {czk(quote.totalCzk)}
            </Typography>
          </Stack>
          {quote.appliedGroupPercent > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Použitá skupinová sleva {formatPercent(quote.appliedGroupPercent)}.
            </Typography>
          )}
          {quote.requiresApproval && (
            <Box
              role="status"
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: DESIGN.tone.beige.bg,
                border: `1px solid ${DESIGN.tone.beige.line}`,
                color: DESIGN.tone.beige.fg,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'inherit' }}>
                {OVER_LIMIT_TEXT}
              </Typography>
              <Typography variant="caption" sx={{ color: 'inherit' }}>
                Bez schválení můžete dát nejvýše {formatPercent(quote.manualAllowedPercent)}.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </SoftCard>
  );
}
