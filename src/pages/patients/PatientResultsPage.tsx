/*
 * Výsledky - one patient's diagnostic sessions, newest first.
 *
 * `GET /api/v1/diagnostics/patients/{id}/sessions` answers every measurement
 * the clinic took of this person. A row reads date · what · the numbers that
 * matter; "Otevřít zprávu" is the existing PDF report of that session, and
 * "Nové měření" the existing diagnostics form for this patient.
 *
 * The session carries no "type": every one is the same diagnostic
 * measurement, so the column says that rather than inventing a classification
 * the server does not make.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import toast from 'react-hot-toast';
import { diagnosticsApi } from '../../api/diagnostics';
import type { DiagnosticSession } from '../../api/diagnostics';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { formatPragueDate } from '../../utils/time';

const present = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** "VO2max 52 ml/min/kg · klidová TF 58 · TK 120/80" - only what was measured. */
export function sessionSummary(s: DiagnosticSession): string {
  const parts: string[] = [];
  if (present(s.vo2MaxMlMinKg)) parts.push(`VO₂max ${s.vo2MaxMlMinKg} ml/min/kg`);
  if (present(s.restingHeartRateBpm)) parts.push(`klidová TF ${s.restingHeartRateBpm}`);
  if (present(s.maxHeartRateBpm)) parts.push(`max. TF ${s.maxHeartRateBpm}`);
  if (present(s.systolicBloodPressure) && present(s.diastolicBloodPressure)) {
    parts.push(`TK ${s.systolicBloodPressure}/${s.diastolicBloodPressure}`);
  }
  if (present(s.bodyFatPercentage)) parts.push(`tuk ${s.bodyFatPercentage} %`);
  return parts.length === 0 ? '—' : parts.join(' · ');
}

export default function PatientResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['patient', id, 'diagnostic-sessions'],
    queryFn: () => diagnosticsApi.getByPatient(id!),
    enabled: id !== undefined,
  });

  const sessions = [...(query.data ?? [])].sort(
    (a, b) => Date.parse(b.sessionDate) - Date.parse(a.sessionDate),
  );

  const openReport = async (session: DiagnosticSession) => {
    try {
      await diagnosticsApi.downloadPdf(session.id);
    } catch {
      toast.error('Zprávu se nepodařilo otevřít');
    }
  };

  return (
    <SoftCard sx={{ p: 0, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Box>
          <SectionLabel sx={{ mb: 0.25 }}>Výsledky</SectionLabel>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Diagnostická měření tohoto pacienta, od nejnovějšího.
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate(`/diagnostics/new?patientId=${id}`)}
        >
          Nové měření
        </Button>
      </Stack>

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={sessions.length === 0}
        isSettled={!query.isLoading}
        emptyText="Zatím tu žádný výsledek není."
        onRetry={() => void query.refetch()}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>Typ</TableCell>
                <TableCell>Shrnutí</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    {formatPragueDate(session.sessionDate)}
                  </TableCell>
                  <TableCell>
                    Diagnostické měření
                    {session.requiresDoctorReview && (
                      <StatusChip tone="beige" size="sm" sx={{ ml: 1 }}>Ke kontrole lékařem</StatusChip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{sessionSummary(session)}</Typography>
                    {session.practitionerName && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {session.practitionerName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => void openReport(session)}>
                      Otevřít zprávu
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AsyncSection>
    </SoftCard>
  );
}
