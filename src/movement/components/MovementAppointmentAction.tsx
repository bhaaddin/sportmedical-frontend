/* In a booking of a movement service: the status of its movement session and the action that opens it (prefilled upload). */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack } from '@mui/material';
import { DirectionsRun } from '@mui/icons-material';
import { StatusChip, type ChipTone } from '../../components/ui';
import { usePermission } from '../../auth/usePermission';
import { movementErrorCode, openAppointmentSession, useMovementSessions } from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { useMoveT, type MoveKey } from '../i18n';
import { sessionStatus, type SessionStatus } from '../lib/review';

const TONE: Record<SessionStatus, ChipTone> = { none: 'grey', processing: 'blue', review: 'beige', done: 'green', failed: 'red' };

export default function MovementAppointmentAction({ appointmentId, patientId, sessionId }: { appointmentId: string; patientId: string; sessionId?: string | null }) {
  const { t } = useMoveT();
  const navigate = useNavigate();
  const mayView = usePermission('movement.view');
  const mayCapture = usePermission('movement.capture');
  const sessions = useMovementSessions(mayView ? patientId : undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = sessions.data?.find((s) => s.id === sessionId || s.appointmentId === appointmentId);
  const status = sessionStatus(session?.clips ?? []);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const sid = session?.id ?? (await openAppointmentSession(appointmentId)).session.id;
      navigate(`${MOVE_PATHS.upload(patientId)}&sessionId=${encodeURIComponent(sid)}`);
    } catch (e) {
      const code = movementErrorCode(e);
      setError(code === 'movement.care_consent_missing' ? t('appointment.no_consent') : code === 'movement.appointment_cancelled' ? t('appointment.cancelled') : t('appointment.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!mayView && !mayCapture) return null;
  return (
    <Stack spacing={1} data-testid="movement-appointment">
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <StatusChip tone={TONE[status]} dot testId="movement-status">{t(`appointment.status.${status}` as MoveKey)}</StatusChip>
        {mayCapture && (
          <Button variant="outlined" startIcon={<DirectionsRun />} onClick={() => void open()} disabled={busy} sx={{ minHeight: 44, textTransform: 'none' }}>
            {session ? t('appointment.open') : t('appointment.start')}
          </Button>
        )}
        {session && session.clips.length > 0 && (
          <Button onClick={() => navigate(MOVE_PATHS.patient(patientId))} sx={{ minHeight: 44, textTransform: 'none' }}>{t('consent.open_timeline')}</Button>
        )}
      </Stack>
      {error && <Alert severity="warning" role="alert"><Box>{error}</Box></Alert>}
    </Stack>
  );
}
