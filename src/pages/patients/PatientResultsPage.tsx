/*
 * Výsledky - one patient's diagnostic sessions, newest first.
 *
 * `GET /api/v1/diagnostics/patients/{id}/sessions` answers every measurement
 * the clinic took of this person. A row reads date · what · the numbers that
 * matter; "Otevřít zprávu" is the existing PDF report of that session, and
 * "Nové měření" the existing diagnostics form for this patient.
 *
 * "Zapsat hodnoty ručně" is the doctor's manual entry (Etapa 2, decision 14):
 * the portal shows what a session stores, "—" for the rest, and this form is
 * how the rest gets typed in when no device handed it over.
 *
 * Three layouts: a card per measurement on a phone, a three-column table on
 * an iPad, the full table on a desktop.
 *
 * The session carries no "type": every one is the same diagnostic
 * measurement, so the column says that rather than inventing a classification
 * the server does not make.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { diagnosticsApi } from '../../api/diagnostics';
import type { DiagnosticSession } from '../../api/diagnostics';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { useIsPhone } from '../../layout/useDevice';
import { formatPragueDate } from '../../utils/time';
import ManualResultsForm from './ManualResultsForm';
import { parseManualExtras } from './manualResults';

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

/** What a doctor typed by hand beyond the stored columns: device, power, zones... */
function ExtraFacts({ session }: { session: DiagnosticSession }) {
  const { facts } = parseManualExtras(session.rawPractitionerNotes);
  if (facts.length === 0) return null;
  return (
    <Box component="dl" sx={{ m: 0, mt: 0.75, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25 }}>
      {facts.map(([label, value], i) => (
        <Box key={`${label}-${i}`} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>{value}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function PatientResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const [entering, setEntering] = useState(false);

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

  const columns: DataColumn<DiagnosticSession>[] = [
    {
      key: 'date',
      header: 'Datum',
      tablet: true,
      cell: (s) => <Box sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatPragueDate(s.sessionDate)}</Box>,
    },
    {
      key: 'type',
      header: 'Typ',
      cell: (s) => (
        <>
          Diagnostické měření
          {s.requiresDoctorReview && <StatusChip tone="beige" size="sm" sx={{ ml: 1 }}>Ke kontrole lékařem</StatusChip>}
        </>
      ),
    },
    {
      key: 'summary',
      header: 'Shrnutí',
      tablet: true,
      cell: (s) => (
        <>
          <Typography variant="body2">{sessionSummary(s)}</Typography>
          {s.practitionerName && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {s.practitionerName}
            </Typography>
          )}
          <ExtraFacts session={s} />
        </>
      ),
    },
    {
      key: 'report',
      header: '',
      align: 'right',
      tablet: true,
      cell: (s) => (
        <Button size="small" variant="outlined" onClick={() => void openReport(s)} sx={{ minHeight: 36 }}>
          Otevřít zprávu
        </Button>
      ),
    },
  ];

  const renderCard = (s: DiagnosticSession) => (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{formatPragueDate(s.sessionDate)}</Typography>
        {s.requiresDoctorReview && <StatusChip tone="beige" size="sm">Ke kontrole lékařem</StatusChip>}
      </Stack>
      <Typography variant="body2">{sessionSummary(s)}</Typography>
      {s.practitionerName && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.practitionerName}</Typography>
      )}
      <ExtraFacts session={s} />
      <Button
        variant="outlined"
        onClick={(e) => { e.stopPropagation(); void openReport(s); }}
        sx={{ minHeight: 44, alignSelf: 'stretch' }}
      >
        Otevřít zprávu
      </Button>
    </Stack>
  );

  return (
    <Stack spacing={2}>
      <SoftCard>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <Box sx={{ flex: 1 }}>
            <SectionLabel sx={{ mb: 0.25 }}>Výsledky</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Diagnostická měření tohoto pacienta, od nejnovějšího.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ '& .MuiButton-root': { minHeight: 44, flex: { xs: 1, sm: 'none' } } }}>
            <Button variant="outlined" onClick={() => setEntering(true)}>
              Zapsat hodnoty ručně
            </Button>
            <Button variant="contained" onClick={() => navigate(`/diagnostics/new?patientId=${id}`)}>
              Nové měření
            </Button>
          </Stack>
        </Stack>
      </SoftCard>

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={sessions.length === 0}
        isSettled={!query.isLoading}
        emptyText="Zatím tu žádný výsledek není."
        onRetry={() => void query.refetch()}
      >
        <ResponsiveDataList
          rows={sessions}
          rowKey={(s) => s.id}
          columns={columns}
          renderCard={renderCard}
          ariaLabel="Výsledky měření"
        />
      </AsyncSection>

      <Dialog
        open={entering}
        onClose={() => setEntering(false)}
        fullScreen={phone}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Zapsat naměřené hodnoty
          <IconButton aria-label="Zavřít" onClick={() => setEntering(false)} sx={{ width: 44, height: 44 }}>
            <Close />
          </IconButton>
        </DialogTitle>
        {/* No shell bottom bar over a dialog: the pinned save button sits at the edge. */}
        <DialogContent sx={{ '--bottom-bar-height': '0px', bgcolor: 'background.default' }}>
          <ManualResultsForm
            patientId={id}
            onCancel={() => setEntering(false)}
            onSaved={() => { setEntering(false); void query.refetch(); }}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
