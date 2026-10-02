import { Typography } from '@mui/material';
import { DESIGN } from '../../theme';
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
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'ink' | 'red' | 'green' | 'primary';
}) {
  const color =
    tone === 'red'
      ? DESIGN.tone.red.fg
      : tone === 'green'
        ? DESIGN.tone.green.fg
        : tone === 'primary'
          ? 'primary.main'
          : 'text.primary';

  return (
    <SoftCard sx={{ p: 2.25 }}>
      <SectionLabel sx={{ mb: 0.75 }}>{label}</SectionLabel>
      <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, color }}>
        {value}
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
