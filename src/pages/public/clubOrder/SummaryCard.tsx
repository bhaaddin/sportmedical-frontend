import { Alert, Box, Typography } from '@mui/material';
import type { OrderActivity, OrderQuote } from '../../../api/publicClubOrder';
import { ARCHIVO, BRAND } from '../../../components/public/brand';
import { FieldLabel, NoticeBox, Panel, PanelTitle, SOFT_TEXT } from '../../../components/public/kit';
import { czk, hhmm } from './model';

export interface SummaryLine {
  activity: OrderActivity;
  seats: number;
}

function Row({ label, value, strong = false, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}>
      <Typography component="span" sx={{ fontSize: strong ? 17 : 15, fontWeight: strong ? 700 : 400, color: strong ? BRAND.text : SOFT_TEXT }}>
        {label}
      </Typography>
      <Typography
        component="span"
        data-testid={testId}
        sx={{ fontFamily: ARCHIVO, fontSize: strong ? 22 : 15, fontWeight: strong ? 800 : 600, color: BRAND.text, textAlign: 'right' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export interface SummaryCardProps {
  lines: SummaryLine[];
  quote: OrderQuote | null;
  pending: boolean;
  failed: boolean;
  /** The server's minimum of players, or null — the hint exists only then. */
  minimumHint: string | null;
  priceNote: string;
  sticky: boolean;
}

/** The live summary: total players, needed time, price lines, the server's discounts and the total. */
export function SummaryCard({ lines, quote, pending, failed, minimumHint, priceNote, sticky }: SummaryCardProps) {
  const empty = lines.length === 0;
  const dash = '—';
  return (
    <Panel
      component="aside"
      labelledBy="club-order-summary"
      sx={sticky ? { position: 'sticky', top: 16, alignSelf: 'flex-start' } : undefined}
    >
      <PanelTitle id="club-order-summary">Shrnutí a cena</PanelTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }} aria-busy={pending}>
        <Row label="Celkem hráčů" value={empty ? dash : String(quote?.totalSeats ?? lines.reduce((n, l) => n + l.seats, 0))} testId="sum-players" />
        <Row label="Potřebný čas" value={empty || quote === null ? dash : hhmm(quote.neededMinutes)} testId="sum-time" />
      </Box>
      {!empty && (
        <Box component="ul" aria-label="Ceny činností" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75, borderTop: `1px solid ${BRAND.line}`, pt: 1.5 }}>
          {lines.map((l) => (
            <Box component="li" key={l.activity.activityId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 14, color: SOFT_TEXT }}>
              <span>{l.activity.name}</span>
              <span>{l.seats} × {czk(l.activity.unitPriceCzk)}</span>
            </Box>
          ))}
        </Box>
      )}
      {quote !== null && !empty && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, borderTop: `1px solid ${BRAND.line}`, pt: 1.5 }}>
          <Row label="Ceník celkem" value={czk(quote.listTotalCzk)} />
          {quote.discounts.map((d, i) => (
            <Row
              key={`${d.kind}-${i}`}
              label={d.percent !== null && d.percent !== undefined ? `${d.label} (${d.percent} %)` : d.label}
              value={`−${czk(Math.abs(d.amountCzk))}`}
            />
          ))}
        </Box>
      )}
      <Box sx={{ borderTop: `1px solid ${BRAND.line}`, pt: 1.5 }}>
        <Row label="Cena celkem" value={empty || quote === null ? dash : czk(quote.totalCzk)} strong testId="sum-total" />
      </Box>
      {failed && <Alert severity="warning">Cenu se teď nepodařilo spočítat. Objednávku můžete odeslat, cenu potvrdí ordinace.</Alert>}
      {minimumHint !== null && <NoticeBox tone="plain">{minimumHint}</NoticeBox>}
      <FieldLabel sx={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: 13 }}>{priceNote}</FieldLabel>
    </Panel>
  );
}
