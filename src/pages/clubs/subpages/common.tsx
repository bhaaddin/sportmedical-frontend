/*
 * Small pieces the four club sub-pages share: the date-range chips, the club colour dot, the seats bar and the
 * "could not load" panel with its retry. Nothing here knows a club, a price or a clinic.
 */
import { Alert, Box, Button, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { FilterChips, SectionLabel } from '../../../components/ui';
import { FIT_FILL_SX, FIT_SCROLL_SX } from '../../../components/ui/fit';
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
      sx={{ minWidth: { xs: 0, sm: 170 } }}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </TextField>
  );
}

/**
 * A titled section of a fitted page. On a tablet and a desktop it takes the room its cell gives it and its content fills
 * that room (a `ResponsiveDataList fill` scrolls its rows inside; `scroll` makes the section's own body scroll, for a
 * stack of cards); a phone's section just flows and the page region scrolls it.
 */
export function FitSection({ title, area, scroll = false, children, sx }: {
  title: string;
  /** The `grid-area` of the cell it sits in. */
  area?: string;
  scroll?: boolean;
  children: React.ReactNode;
  sx?: object;
}) {
  const phone = useIsPhone();
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...(phone ? {} : { minHeight: 0 }), ...(area !== undefined ? { gridArea: area } : {}), ...sx }}
    >
      <SectionLabel component="h2" sx={{ mb: 1, flexShrink: 0 }}>{title}</SectionLabel>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...(phone ? {} : { ...FIT_FILL_SX, ...(scroll ? FIT_SCROLL_SX : {}) }) }}>{children}</Box>
    </Box>
  );
}
