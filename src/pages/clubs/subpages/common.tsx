/*
 * Small pieces the four club sub-pages share: the date-range chips, the club colour dot, the seats bar and the
 * "could not load" panel with its retry. Nothing here knows a club, a price or a clinic.
 */
import { Alert, Box, Button, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { FilterChips } from '../../../components/ui';
import { useIsPhone } from '../../../layout/useDevice';
import { RANGE_OPTIONS, type DateRange, type RangeKey } from './range';

export function ClubDot({ color }: { color: string | null }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: color ?? 'divider', flexShrink: 0 }}
    />
  );
}

export function SeatsBar({ registered, seats, label }: { registered: number; seats: number; label?: string }) {
  const pct = seats > 0 ? Math.min(100, Math.round((registered / seats) * 100)) : 0;
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label ?? `${registered} / ${seats}`}
      </Typography>
      <LinearProgress variant="determinate" value={pct} aria-label={`Obsazeno ${pct} %`} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
    </Box>
  );
}

export function LoadError({ message = 'Data se nepodařilo načíst.', onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Zkusit znovu</Button>}>
      {message}
    </Alert>
  );
}

export function RangeFilter({
  value,
  custom,
  onChange,
  onCustom,
}: {
  value: RangeKey;
  custom: DateRange;
  onChange: (next: RangeKey) => void;
  onCustom: (next: DateRange) => void;
}) {
  const phone = useIsPhone();
  return (
    <Stack spacing={1}>
      <FilterChips options={RANGE_OPTIONS} value={value} onChange={onChange} ariaLabel="Období" />
      {value === 'custom' && (
        <Stack direction={phone ? 'column' : 'row'} spacing={1}>
          <TextField
            type="date"
            size="small"
            label="Od"
            value={custom.from ?? ''}
            onChange={(e) => onCustom({ ...custom, from: e.target.value === '' ? null : e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            size="small"
            label="Do"
            value={custom.to ?? ''}
            onChange={(e) => onCustom({ ...custom, to: e.target.value === '' ? null : e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      )}
    </Stack>
  );
}

/** A labelled native select, the same on every width. */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 170 }}
      slotProps={{ select: { native: true } }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </TextField>
  );
}
