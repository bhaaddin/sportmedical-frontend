/*
 * "Činnosti a počty hráčů": every činnost of the chosen service is a row - tick it, type how many players the
 * club brings, step the number by ten. Edit mode shows `registered / seats` and refuses a number below it.
 */
import { Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { SectionLabel, SoftCard } from '../../ui';
import { plural } from '../blockLogic';
import { formatCzk } from './orderFormat';

export interface OrderActivityItem {
  id: string;
  name: string;
  durationMinutes: number | null;
  color: string | null;
  unitPriceCzk: number | null;
  registered: number | null;
}

export function OrderSeatsSection({
  serviceChosen, items, checked, text, errors, total, listError, showErrors, fieldSize, disabled, onToggle, onChange, onStep,
}: {
  serviceChosen: boolean;
  items: OrderActivityItem[];
  checked: string[];
  text: Record<string, string>;
  /** Per činnost: "nejméně 5" etc. */
  errors: Record<string, string>;
  total: number;
  listError: string | undefined;
  showErrors: boolean;
  fieldSize: 'small' | 'medium';
  disabled: boolean;
  onToggle: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onStep: (id: string, delta: number) => void;
}) {
  return (
    <Box data-testid="order-seats">
      <SectionLabel>Činnosti a počty hráčů</SectionLabel>
      {!serviceChosen ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nejdřív vyberte službu — nabídnou se její činnosti.</Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Tato služba zatím nemá žádnou činnost.</Typography>
      ) : (
        <SoftCard sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            {items.map((a) => {
              const on = checked.includes(a.id);
              const typed = text[a.id] ?? '';
              const err = errors[a.id];
              return (
                <Box key={a.id} data-testid="order-activity" data-activity={a.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1, '&:last-of-type': { borderBottom: 0, pb: 0 } }}>
                  <FormControlLabel
                    disabled={disabled}
                    sx={{ display: 'flex', mx: 0, minHeight: 44 }}
                    control={<Checkbox checked={on} onChange={() => onToggle(a.id)} />}
                    label={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
                        {a.color !== null ? <Box component="span" aria-hidden="true" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: a.color, flexShrink: 0 }} /> : null}
                        <Typography component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{a.name}</Typography>
                        {a.durationMinutes !== null ? <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{`${a.durationMinutes} min`}</Typography> : null}
                        {a.unitPriceCzk !== null ? <Typography component="span" variant="caption" data-testid="unit-price" sx={{ color: 'text.secondary' }}>{`${formatCzk(a.unitPriceCzk)} / osoba`}</Typography> : null}
                      </Stack>
                    }
                  />
                  {on ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', pl: { xs: 0, sm: 4 }, flexWrap: 'wrap', rowGap: 1 }}>
                      <Box sx={{ width: 150 }}>
                        <TextField
                          size={fieldSize}
                          label="Počet hráčů"
                          value={typed}
                          disabled={disabled}
                          onChange={(e) => onChange(a.id, e.target.value)}
                          error={err !== undefined || (showErrors && typed.trim() === '')}
                          slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Počet hráčů, ${a.name}` } }}
                          fullWidth
                        />
                      </Box>
                      <Button variant="outlined" disabled={disabled} onClick={() => onStep(a.id, -10)} aria-label={`Ubrat 10 hráčů, ${a.name}`} sx={{ minHeight: 44, minWidth: 56 }}>−10</Button>
                      <Button variant="outlined" disabled={disabled} onClick={() => onStep(a.id, 10)} aria-label={`Přidat 10 hráčů, ${a.name}`} sx={{ minHeight: 44, minWidth: 56 }}>+10</Button>
                      {a.registered !== null ? (
                        <Typography variant="caption" data-testid="seats-registered" sx={{ alignSelf: 'center', color: err ? 'error.main' : 'text.secondary' }}>
                          {`${a.registered} / ${typed.trim() === '' ? '…' : typed.trim()} obsazeno`}
                          {err ? ` — ${err}` : ''}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
          <Typography data-testid="order-total-seats" sx={{ fontSize: 14, fontWeight: 700, pt: 1.25, mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            {`Celkem ${total.toLocaleString('cs-CZ')} ${plural(total, ['místo', 'místa', 'míst'])}`}
          </Typography>
        </SoftCard>
      )}
      {showErrors && listError !== undefined ? <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{listError}</Typography> : null}
    </Box>
  );
}
