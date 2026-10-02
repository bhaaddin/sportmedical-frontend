import { Box, Typography } from '@mui/material';
import { SectionLabel } from '../ui';

/**
 * The board's label-over-value pair: RODNÉ ČÍSLO in small caps, the value in
 * bold beneath. One shape for the whole OSOBNÍ ÚDAJE grid and the KLUB rail.
 */
export function LabelValue({
  label,
  value,
  mono = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** For identifiers that are read digit by digit. */
  mono?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <SectionLabel sx={{ mb: 0.25 }}>{label}</SectionLabel>
      <Typography
        sx={{
          fontWeight: 600,
          fontSize: 15,
          lineHeight: 1.35,
          overflowWrap: 'anywhere',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default LabelValue;
