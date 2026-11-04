/* The card on a patient's page (only with the flag on): the latest rating and the trend, the way into the timeline and the upload,
   the reports in the documents, and the two consents. */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { usePermission } from '../../auth/usePermission';
import { cardSurface } from '../../ui/shelf';
import { useMovementSessions } from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { useMoveT } from '../i18n';
import { bandSparkline } from '../lib/review';
import { ConsentPanel } from '../components/ConsentPanel';
import { BandChip } from '../components/Findings';

/** A tiny line of the ratings over time: green at the bottom, red at the top. */
export function Sparkline({ points }: { points: { level: 1 | 2 | 3; band: 'green' | 'watch' | 'red' }[] }) {
  const W = 120;
  const H = 32;
  const xy = points.map((p, i) => [points.length === 1 ? W / 2 : 6 + (i / (points.length - 1)) * (W - 12), H - 6 - ((p.level - 1) / 2) * (H - 12)] as const);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="trend" data-testid="sparkline">
      {xy.length > 1 && <Box component="polyline" points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" strokeWidth={1.5} sx={(th) => ({ stroke: th.palette.text.secondary })} />}
      {xy.map(([x, y], i) => (
        <Box key={i} component="circle" cx={x} cy={y} r={3.5} sx={(th) => ({ fill: points[i].band === 'green' ? th.palette.success.main : points[i].band === 'red' ? th.palette.error.main : th.palette.warning.main })} />
      ))}
    </svg>
  );
}

export default function PatientMovementCard({ patientId }: { patientId: string }) {
  const { t } = useMoveT();
  const mayView = usePermission('movement.view');
  const mayCapture = usePermission('movement.capture');
  const mayDocs = usePermission('documents.view');
  const sessions = useMovementSessions(mayView ? patientId : undefined);
  if (!mayView) return null;
  const points = bandSparkline(sessions.data ?? []);
  const latest = points[points.length - 1];
  return (
    <Box role="listitem" data-card="related" data-related="movement" sx={(th) => ({ ...cardSurface(th, false), p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, gridColumn: '1 / -1' })}>
      <Box>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>{t('title')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('consent.card.hint')}</Typography>
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, flexWrap: 'wrap' }} data-testid="patient-movement-summary">
        {latest ? (
          <>
            <Box><Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{t('patient.latest')}</Typography><BandChip band={latest.band} /></Box>
            <Box><Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{t('patient.trend')}</Typography><Sparkline points={points} /></Box>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{sessions.isLoading ? '…' : t('patient.no_data')}</Typography>
        )}
      </Stack>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to={MOVE_PATHS.patient(patientId)} variant="outlined" sx={{ minHeight: 44, textTransform: 'none' }}>{t('consent.open_timeline')}</Button>
        {mayCapture && <Button component={RouterLink} to={MOVE_PATHS.upload(patientId)} variant="contained" sx={{ minHeight: 44, textTransform: 'none' }}>{t('action.upload')}</Button>}
        {mayDocs && <Button component={RouterLink} to={`/patients/${patientId}/dokumenty`} sx={{ minHeight: 44, textTransform: 'none' }}>{t('patient.documents')}</Button>}
      </Stack>
      <ConsentPanel patientId={patientId} />
    </Box>
  );
}
