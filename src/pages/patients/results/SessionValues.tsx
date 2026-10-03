/*
 * Every measured value of one session as a label/value grid, plus its training
 * zones. "—" for what was not measured. Used by the Výsledky tab, in the table
 * on a desktop and in the card on a phone.
 */
import { Box, Typography } from '@mui/material';
import type { DiagnosticSession } from '../../../api/diagnostics';
import { MISSING, sessionValueRows, zoneRange } from './measuredValues';

export default function SessionValues({ session }: { session: DiagnosticSession }) {
  const rows = sessionValueRows(session);
  const zones = session.trainingZones ?? [];
  return (
    <Box data-testid="session-values">
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(150px, 1fr))' },
          columnGap: 2,
          rowGap: 0.75,
        }}
      >
        {rows.map((r) => (
          <Box key={r.key} sx={{ minWidth: 0 }}>
            <Typography component="dt" variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{r.label}</Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, overflowWrap: 'anywhere', color: r.value === MISSING ? 'text.disabled' : 'text.primary', fontWeight: r.value === MISSING ? 400 : 600 }}
            >
              {r.value}
            </Typography>
          </Box>
        ))}
      </Box>
      {zones.length > 0 && (
        <Box component="ul" aria-label="Tréninkové zóny" sx={{ listStyle: 'none', m: 0, mt: 1, p: 0 }}>
          {zones.map((z, i) => (
            <Box component="li" key={`${z.name}-${i}`} sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{z.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {zoneRange(z) === '' ? MISSING : zoneRange(z)}{z.note ? ` · ${z.note}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
