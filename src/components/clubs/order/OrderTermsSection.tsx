/*
 * "Termíny": one editable row per range (Od, Do, Denně od/do), the automatic suggestion on top, and the
 * buttons that add a row or repeat one on the next week. The proposal only fills the rows - every row stays
 * editable, and counting starts exactly at "Denně od".
 */
import { Alert, Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import { DeleteOutlined } from '@mui/icons-material';
import { SectionLabel, SoftCard } from '../../ui';
import { countingSentence } from '../blockLogic';
import type { RangeRow, RowErrors } from '../blockLogic';
import { WEEKDAYS } from './orderLogic';

export interface ProposalControls {
  weekdays: number[];
  weeks: number;
  onToggleWeekday: (value: number) => void;
  onWeeks: (weeks: number) => void;
  onPropose: () => void;
  /** Why the button is disabled, or null when it can run. */
  blockedReason: string | null;
  busy: boolean;
  message: string | null;
  failure: string | null;
}

export function OrderTermsSection({
  rows, rowErrors, failures, showErrors, fieldSize, disabled, proposal, termsError,
  onChange, onRemove, onAdd, onRepeat, onMoveToToday,
}: {
  rows: RangeRow[];
  rowErrors: RowErrors[];
  failures: Record<string, string>;
  showErrors: boolean;
  fieldSize: 'small' | 'medium';
  disabled: boolean;
  proposal: ProposalControls;
  termsError: string | undefined;
  onChange: (key: string, patch: Partial<RangeRow>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onRepeat: (key: string) => void;
  onMoveToToday: (key: string) => void;
}) {
  return (
    <Box data-testid="order-terms">
      <SectionLabel>Termíny</SectionLabel>
      <SoftCard sx={{ p: 1.75, mb: 1.5 }} data-testid="order-proposal">
        <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>Automatický návrh</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Začátek vezme z prvního termínu (den a Denně od). Počítá se přesně od zadaného času, dřívější čas do rezervace nepatří.
        </Typography>
        <Stack direction="row" role="group" aria-label="Dny v týdnu" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
          {WEEKDAYS.map((d) => {
            const on = proposal.weekdays.includes(d.value);
            return (
              <Chip
                key={d.value}
                label={d.label}
                clickable
                color={on ? 'primary' : 'default'}
                variant={on ? 'filled' : 'outlined'}
                aria-pressed={on}
                onClick={() => proposal.onToggleWeekday(d.value)}
                sx={{ minHeight: 36, minWidth: 44 }}
              />
            );
          })}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <Typography component="span" sx={{ fontSize: 14 }}>Týdnů</Typography>
          <Button variant="outlined" aria-label="Méně týdnů" disabled={proposal.weeks <= 1} onClick={() => proposal.onWeeks(proposal.weeks - 1)} sx={{ minHeight: 44, minWidth: 44 }}>−</Button>
          <Typography component="span" data-testid="proposal-weeks" sx={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{proposal.weeks}</Typography>
          <Button variant="outlined" aria-label="Více týdnů" disabled={proposal.weeks >= 52} onClick={() => proposal.onWeeks(proposal.weeks + 1)} sx={{ minHeight: 44, minWidth: 44 }}>+</Button>
          <Button variant="contained" onClick={proposal.onPropose} disabled={disabled || proposal.blockedReason !== null || proposal.busy} sx={{ minHeight: 44 }}>
            {proposal.busy ? 'Navrhuji…' : 'Navrhnout termíny'}
          </Button>
        </Stack>
        {proposal.blockedReason !== null ? (
          <Typography variant="caption" data-testid="proposal-hint" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>{proposal.blockedReason}</Typography>
        ) : null}
        {proposal.message !== null ? <Typography variant="caption" role="status" sx={{ display: 'block', mt: 0.75 }}>{proposal.message}</Typography> : null}
        {proposal.failure !== null ? <Alert severity="error" sx={{ mt: 1 }}>{proposal.failure}</Alert> : null}
      </SoftCard>

      <Stack spacing={1.5}>
        {rows.map((row, i) => (
          <TermRow
            key={row.key}
            index={i}
            total={rows.length}
            row={row}
            errors={rowErrors[i] ?? {}}
            showErrors={showErrors}
            failure={failures[row.key] ?? null}
            fieldSize={fieldSize}
            disabled={disabled}
            onChange={(patch) => onChange(row.key, patch)}
            onRemove={() => onRemove(row.key)}
            onRepeat={() => onRepeat(row.key)}
            onMoveToToday={() => onMoveToToday(row.key)}
          />
        ))}
        <Button variant="outlined" onClick={onAdd} disabled={disabled} sx={{ minHeight: 44, alignSelf: 'flex-start' }}>
          + Přidat termín
        </Button>
      </Stack>
      {showErrors && termsError !== undefined ? <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{termsError}</Typography> : null}
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
        Prázdné Denně od/do = celá otevírací doba. Termín můžete posunout, prodloužit, zkrátit nebo smazat.
      </Typography>
    </Box>
  );
}

function TermRow({
  index, total, row, errors, showErrors, failure, fieldSize, disabled, onChange, onRemove, onRepeat, onMoveToToday,
}: {
  index: number;
  total: number;
  row: RangeRow;
  errors: RowErrors;
  showErrors: boolean;
  failure: string | null;
  fieldSize: 'small' | 'medium';
  disabled: boolean;
  onChange: (patch: Partial<RangeRow>) => void;
  onRemove: () => void;
  onRepeat: () => void;
  onMoveToToday: () => void;
}) {
  const n = index + 1;
  const shown = (k: keyof RowErrors): string | undefined => (showErrors ? errors[k] : undefined);
  const aria = (label: string) => ({ 'aria-label': `${label}, termín ${n}` });
  return (
    <SoftCard sx={{ p: 1.75, borderColor: failure !== null ? 'error.main' : undefined }} data-testid="order-term-row" data-failed={failure !== null ? 'true' : undefined}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{`Termín ${n}`}</Typography>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={onRepeat} disabled={disabled} aria-label={`Zopakovat termín ${n} na další týden`} sx={{ minHeight: 44 }}>
            Zopakovat na další týden
          </Button>
          {total > 1 ? (
            <IconButton aria-label={`Odebrat termín ${n}`} onClick={onRemove} disabled={disabled} sx={{ width: 44, height: 44 }}>
              <DeleteOutlined />
            </IconButton>
          ) : null}
        </Stack>
      </Stack>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField type="date" size={fieldSize} label="Od" value={row.fromDate} onChange={(e) => onChange({ fromDate: e.target.value })}
            error={shown('fromDate') !== undefined || errors.past !== undefined} helperText={shown('fromDate')} disabled={disabled}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Od') }} fullWidth />
          <TextField type="date" size={fieldSize} label="Do" value={row.toDate} onChange={(e) => onChange({ toDate: e.target.value })}
            error={shown('toDate') !== undefined} helperText={shown('toDate')} disabled={disabled}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Do') }} fullWidth />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField type="time" size={fieldSize} label="Denně od" value={row.dailyFrom} onChange={(e) => onChange({ dailyFrom: e.target.value })}
            error={shown('dailyFrom') !== undefined} helperText={shown('dailyFrom')} disabled={disabled}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Denně od') }} fullWidth />
          <TextField type="time" size={fieldSize} label="Denně do" value={row.dailyTo} onChange={(e) => onChange({ dailyTo: e.target.value })}
            error={shown('dailyTo') !== undefined} helperText={shown('dailyTo')} disabled={disabled}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: aria('Denně do') }} fullWidth />
        </Stack>
      </Stack>
      <Typography variant="caption" data-testid="row-window" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        {countingSentence(row)}
      </Typography>
      {errors.past !== undefined ? (
        <Alert severity="warning" role="alert" sx={{ mt: 1.25 }}
          action={<Button color="inherit" size="small" onClick={onMoveToToday} disabled={disabled} sx={{ minHeight: 36 }}>Posunout na dnešek</Button>}>
          {errors.past}
        </Alert>
      ) : null}
      {errors.overlap !== undefined ? <Typography role="alert" variant="body2" sx={{ color: 'error.main', mt: 1 }}>{errors.overlap}</Typography> : null}
      {failure !== null ? <Alert severity="error" sx={{ mt: 1.25 }} data-testid="row-failure">{failure}</Alert> : null}
    </SoftCard>
  );
}
