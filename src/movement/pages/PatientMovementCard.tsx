/* The card on a patient's page (only with the flag on): the way into the timeline and the two consents. */
import { Link as RouterLink } from 'react-router-dom';
import { usePermission } from '../../auth/usePermission';
import { Box, Button, Stack, Typography } from '@mui/material';
import { cardSurface } from '../../ui/shelf';
import { MOVE_PATHS } from '../flags';
import { useMoveT } from '../i18n';
import { ConsentPanel } from '../components/ConsentPanel';

export default function PatientMovementCard({ patientId }: { patientId: string }) {
  const { t } = useMoveT();
  const mayView = usePermission('movement.view');
  const mayCapture = usePermission('movement.capture');
  if (!mayView) return null;
  return (
    <Box role="listitem" data-card="related" data-related="movement" sx={(th) => ({ ...cardSurface(th, false), p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, gridColumn: '1 / -1' })}>
      <Box>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>{t('title')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('consent.card.hint')}</Typography>
      </Box>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to={MOVE_PATHS.patient(patientId)} variant="outlined" sx={{ minHeight: 44, textTransform: 'none' }}>{t('consent.open_timeline')}</Button>
        {mayCapture && <Button component={RouterLink} to={MOVE_PATHS.upload(patientId)} variant="contained" sx={{ minHeight: 44, textTransform: 'none' }}>{t('action.upload')}</Button>}
      </Stack>
      <ConsentPanel patientId={patientId} />
    </Box>
  );
}
