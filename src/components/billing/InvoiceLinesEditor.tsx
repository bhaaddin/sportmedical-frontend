/*
 * The lines of the new document: činnosti from the price list, each with how
 * many. The price shown beside a činnost is read from the ceník through the
 * činnost; what the line costs after discounts is the server's quote.
 */
import { Box, Button, ButtonBase, IconButton, Stack, TextField, Typography } from '@mui/material';
import { Add, Check, Remove } from '@mui/icons-material';
import type { Activity } from '../../api/bookingContracts';
import type { DraftLine } from '../../pages/billing/invoicePrefill';
import { czk } from '../../pages/billing/money';
import { DESIGN } from '../ui';

export const MAX_QUANTITY = 10000;

export default function InvoiceLinesEditor({
  activities,
  lines,
  loading,
  failed,
  onRetry,
  onToggle,
  onQuantity,
}: {
  /** Činnosti that can be billed: active and with a price in the ceník. */
  activities: Pick<Activity, 'id' | 'name' | 'durationMinutes' | 'priceCzk'>[];
  lines: DraftLine[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onToggle: (activityId: string) => void;
  onQuantity: (activityId: string, quantity: number) => void;
}) {
  const nameOf = (id: string) => activities.find((a) => a.id === id)?.name ?? 'Činnost z ceníku';

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {failed && (
        <Box role="alert" sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: DESIGN.tone.red.fg }}>Ceník se nepodařilo načíst.</Typography>
          <Button size="small" variant="outlined" onClick={onRetry}>Zkusit znovu</Button>
        </Box>
      )}
      {!failed && !loading && activities.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ceník je prázdný — žádná činnost nemá cenu.
        </Typography>
      )}

      <Box
        role="group"
        aria-label="Činnosti z ceníku"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
          maxHeight: { xs: 280, md: 240 },
          overflow: 'auto',
          p: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        {activities.map((a) => {
          const selected = lines.some((l) => l.activityId === a.id);
          return (
            <ButtonBase
              key={a.id}
              onClick={() => onToggle(a.id)}
              aria-pressed={selected}
              sx={{
                minHeight: 52,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                justifyContent: 'space-between',
                gap: 1.5,
                textAlign: 'left',
                border: '1px solid',
                borderColor: selected ? DESIGN.softPrimary.line : 'divider',
                bgcolor: selected ? DESIGN.softPrimary.bg : 'background.paper',
              }}
            >
              <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                {selected && <Check fontSize="small" color="primary" />}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontSize: 14 }}>{a.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{a.durationMinutes}&nbsp;min</Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {czk(a.priceCzk)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {lines.length > 0 && (
        <Stack spacing={1} aria-label="Vybrané položky" role="group">
          {lines.map((l) => {
            const name = nameOf(l.activityId);
            return (
              <Stack key={l.activityId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{name}</Typography>
                <IconButton
                  aria-label={`Méně ${name}`}
                  onClick={() => onQuantity(l.activityId, l.quantity - 1)}
                  disabled={l.quantity <= 1}
                  sx={{ width: 44, height: 44 }}
                >
                  <Remove fontSize="small" />
                </IconButton>
                <TextField
                  type="number"
                  value={l.quantity}
                  onChange={(e) => onQuantity(l.activityId, Number(e.target.value))}
                  slotProps={{
                    htmlInput: {
                      min: 1, max: MAX_QUANTITY, 'aria-label': `Počet ${name}`, style: { textAlign: 'center' },
                    },
                  }}
                  sx={{ width: 88 }}
                />
                <IconButton
                  aria-label={`Více ${name}`}
                  onClick={() => onQuantity(l.activityId, l.quantity + 1)}
                  sx={{ width: 44, height: 44 }}
                >
                  <Add fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
