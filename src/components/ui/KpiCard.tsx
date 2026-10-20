import { Typography } from '@mui/material';
import { toneColors } from '../../theme';
import { CountUp } from '../../motion/CountUp';
import { SectionLabel } from './SectionLabel';
import { SoftCard } from './SoftCard';

/**
 * The number card at the top of Fakturace on the board: a label, a big figure,
 * one quiet line under it. `tone="red"` is for money that is owed.
 */
export function KpiCard({
  label,
  value,
  hint,
  tone = 'ink',
  countTo,
  format,
  pending = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'ink' | 'red' | 'green' | 'primary';
  /** The figure counts up to this number, once, when it first has its data (and only with full motion). `value` stays the plain text. */
  countTo?: number;
  /** How the counted number is written (default: Czech grouping). */
  format?: (n: number) => string;
  /** The data has not arrived: show `value` as it is; the count starts when this turns false. */
  pending?: boolean;
}) {
  return (
    <SoftCard sx={{ p: 2.25 }}>
      <SectionLabel sx={{ mb: 0.75 }}>{label}</SectionLabel>
      <Typography
        sx={(t) => ({
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          color:
            tone === 'red'
              ? toneColors(t, 'red').fg
              : tone === 'green'
                ? toneColors(t, 'green').fg
                : tone === 'primary'
                  ? 'primary.main'
                  : 'text.primary',
        })}
      >
        {countTo !== undefined && !pending ? <CountUp value={countTo} format={format} /> : value}
      </Typography>
      {hint !== undefined && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </SoftCard>
  );
}

export default KpiCard;
