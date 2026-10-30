/*
 * "Vyšetření" on an appointment: start the diagnostic examination for exactly this visit, and list the examinations already
 * saved against it. The server links a session to a visit when `appointmentId` is sent (and answers it back on the sessions
 * of the patient); an older server knows nothing of it, so the list simply stays empty and only the button shows.
 */
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { diagnosticsApi } from '../../api/diagnostics';
import { SectionLabel } from '../ui';
import { formatPragueDate } from '../../utils/time';

export const examinationPath = (patientId: string, appointmentId: string): string =>
  `/diagnostics/new?patientId=${encodeURIComponent(patientId)}&appointmentId=${encodeURIComponent(appointmentId)}`;

export function AppointmentExamination({ patientId, appointmentId }: { patientId: string; appointmentId: string }) {
  const sessions = useQuery({
    queryKey: ['diagnostic-sessions', patientId],
    queryFn: () => diagnosticsApi.getByPatient(patientId),
    retry: false,
    staleTime: 30_000,
  });
  const linked = (sessions.data ?? []).filter((s) => s.appointmentId === appointmentId);

  return (
    <Box>
      <SectionLabel>Vyšetření</SectionLabel>
      <Stack spacing={1}>
        {linked.map((s) => (
          <Typography key={s.id} variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button component={RouterLink} to={`/patients/${patientId}/vysledky`} size="small" sx={{ minHeight: 44 }}>
              Vyšetření z {formatPragueDate(s.sessionDate)}
            </Button>
            <span>{s.practitionerName}</span>
          </Typography>
        ))}
        <Box>
          <Button component={RouterLink} to={examinationPath(patientId, appointmentId)} variant="outlined" sx={{ minHeight: 44 }}>
            {linked.length > 0 ? 'Další vyšetření' : 'Zahájit vyšetření'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
