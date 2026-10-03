/*
 * "Místa pro klub" - one row per CHOSEN činnost: its name and length, the
 * number of players the club brings on it, and (once the analysis knows the
 * time window) how many would fit if that činnost had the windows to itself.
 * The footer adds it up: the club is counted as one whole.
 *
 * Against a server that does not answer with an analysis the table keeps only
 * the names and one "Počet hráčů" field takes the headcount (the old way).
 */
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { SectionLabel, SoftCard } from '../../ui';
import { plural } from '../blockLogic';

export interface SeatRow {
  id: string;
  name: string;
  durationMinutes: number | null;
  color: string | null;
  /** As typed. */
  text: string;
  /** "vejde se max." from the analysis; null = unknown. */
  max: number | null;
  /** Edit mode: how many are registered on this činnost already. */
  registered: number | null;
  /** The sentence under the field, e.g. "nejméně 12". */
  error: string | undefined;
}

export function SeatsTable({
  rows, total, onChange, legacy, fill, fillMessage, fieldSize, showErrors, listError,
}: {
  rows: SeatRow[];
  total: number;
  onChange: (id: string, text: string) => void;
  /** The single headcount of a legacy server; replaces the per-row fields. */
  legacy: { text: string; onChange: (text: string) => void; error: string | undefined } | null;
  fill: { onClick: () => void; disabled: boolean } | null;
  fillMessage: string | null;
  fieldSize: 'small' | 'medium';
  showErrors: boolean;
  /** "Zadejte počet hráčů …" when the form was sent with an empty seat. */
  listError: string | undefined;
}) {
  return (
    <SoftCard sx={{ p: 1.75 }} data-testid="seats-table">
      <SectionLabel>Místa pro klub</SectionLabel>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vyberte činnosti — u každé zadáte, kolik hráčů klub přivede.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {rows.map((row) => (
            <Box
              key={row.id}
              data-testid="seats-row"
              data-activity={row.id}
              sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 170px' }, gap: 1, alignItems: 'start' }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, minHeight: { sm: 40 } }}>
                {row.color !== null ? (
                  <Box component="span" aria-hidden="true" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: row.color, flexShrink: 0 }} />
                ) : null}
                <Typography component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{row.name}</Typography>
                {row.durationMinutes !== null ? (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{`${row.durationMinutes} min`}</Typography>
                ) : null}
              </Stack>
              {legacy === null ? (
                <Box>
                  <TextField
                    size={fieldSize}
                    label="Počet hráčů"
                    value={row.text}
                    onChange={(e) => onChange(row.id, e.target.value)}
                    error={row.error !== undefined || (showErrors && row.text.trim() === '')}
                    slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Počet hráčů, ${row.name}` } }}
                    fullWidth
                  />
                  {row.registered !== null ? (
                    <Typography variant="caption" data-testid="seats-registered" sx={{ display: 'block', mt: 0.25, color: row.error ? 'error.main' : 'text.secondary' }}>
                      {`${row.registered} / ${row.text.trim() === '' ? '…' : row.text.trim()} obsazeno`}
                      {row.error ? ` — ${row.error}` : ''}
                    </Typography>
                  ) : row.error ? (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'error.main' }}>{row.error}</Typography>
                  ) : null}
                  {row.max !== null ? (
                    <Typography variant="caption" data-testid="seats-max" sx={{ display: 'block', mt: 0.25, color: 'text.secondary' }}>
                      {`vejde se max. ${row.max.toLocaleString('cs-CZ')}`}
                    </Typography>
                  ) : null}
                </Box>
              ) : null}
            </Box>
          ))}

          {legacy !== null ? (
            <TextField
              size={fieldSize}
              label="Počet hráčů"
              value={legacy.text}
              onChange={(e) => legacy.onChange(e.target.value)}
              error={legacy.error !== undefined}
              helperText={legacy.error ?? 'Kolik sportovců klub přivede. Server zatím nepočítá místa po činnostech.'}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              fullWidth
            />
          ) : (
            <Typography
              data-testid="seats-total"
              sx={{ fontSize: 14, fontWeight: 700, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
            >
              {`Celkem: ${total.toLocaleString('cs-CZ')} ${plural(total, ['místo', 'místa', 'míst'])}`}
            </Typography>
          )}
          {legacy === null && showErrors && listError !== undefined ? (
            <Typography variant="caption" sx={{ color: 'error.main' }}>{listError}</Typography>
          ) : null}

          {fill !== null ? (
            <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
              <Button variant="outlined" onClick={fill.onClick} disabled={fill.disabled} sx={{ minHeight: 44 }}>
                Spočítat počet hráčů z vybraného času
              </Button>
              {fillMessage !== null ? (
                <Typography variant="caption" role="status" data-testid="seats-fill-message" sx={{ color: 'text.secondary' }}>
                  {fillMessage}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
          {legacy === null ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Klub se počítá jako celek — součet míst se porovná s časem ve vybraných termínech.
            </Typography>
          ) : null}
        </Stack>
      )}
    </SoftCard>
  );
}
