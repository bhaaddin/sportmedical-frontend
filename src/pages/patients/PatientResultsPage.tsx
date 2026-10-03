/*
 * Výsledky - one patient's diagnostic sessions, newest first.
 *
 * `GET /api/v1/diagnostics/patients/{id}/sessions` answers every measurement
 * the clinic took of this person. A row reads date · what · the numbers that
 * matter; "Otevřít zprávu" is the existing PDF report of that session, and
 * "Nové měření" the existing diagnostics form for this patient.
 *
 * Every value comes from the session's own columns (contract C-M) - the date of
 * the measurement, threshold %, power and W/kg, weight, zones, device and
 * protocol type included; "—" for what was not measured. Nothing is read out
 * of the doctor's notes. "Zapsat hodnoty ručně" is the doctor's manual entry,
 * and "Upravit" opens the same form prefilled from the session (PUT).
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
import { Close, EditOutlined } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { diagnosticsApi } from '../../api/diagnostics';
import type { DiagnosticSession } from '../../api/diagnostics';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { usePermission } from '../../auth/usePermission';
import { useIsPhone } from '../../layout/useDevice';
import { formatPragueDate } from '../../utils/time';
import ManualResultsForm from './ManualResultsForm';
import SessionValues from './results/SessionValues';
import { measurementDate } from './results/measuredValues';

/** A yyyy-MM-dd day, or an instant read in the clinic's zone. */
const formatDay = (value: string): string => {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return plain !== null ? `${Number(plain[3])}. ${Number(plain[2])}. ${plain[1]}` : formatPragueDate(value);
};

export default function PatientResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const mayEdit = usePermission('patients.edit');
  /** The dialog: a new entry, or the session being edited. */
  const [entering, setEntering] = useState(false);
  const [editing, setEditing] = useState<DiagnosticSession | null>(null);
  const closeDialog = () => { setEntering(false); setEditing(null); };

  const query = useQuery({
    queryKey: ['patient', id, 'diagnostic-sessions'],
    queryFn: () => diagnosticsApi.getByPatient(id!),
    enabled: id !== undefined,
  });

  const sessions = [...(query.data ?? [])].sort(
    (a, b) => Date.parse(measurementDate(b)) - Date.parse(measurementDate(a)),
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
      cell: (s) => <Box sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatDay(measurementDate(s))}</Box>,
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
      key: 'values',
      header: 'Naměřené hodnoty',
      tablet: true,
      cell: (s) => (
        <>
          <SessionValues session={s} />
          {s.practitionerName && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {s.practitionerName}
            </Typography>
          )}
        </>
      ),
    },
    {
      key: 'report',
      header: '',
      align: 'right',
      tablet: true,
      cell: (s) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          {mayEdit && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditOutlined />}
              aria-label={`Upravit měření ${formatDay(measurementDate(s))}`}
              onClick={() => setEditing(s)}
              sx={{ minHeight: 36 }}
            >
              Upravit
            </Button>
          )}
          <Button size="small" variant="outlined" onClick={() => void openReport(s)} sx={{ minHeight: 36 }}>
            Otevřít zprávu
          </Button>
        </Stack>
      ),
    },
  ];

  const renderCard = (s: DiagnosticSession) => (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{formatDay(measurementDate(s))}</Typography>
        {s.requiresDoctorReview && <StatusChip tone="beige" size="sm">Ke kontrole lékařem</StatusChip>}
      </Stack>
      <SessionValues session={s} />
      {s.practitionerName && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.practitionerName}</Typography>
      )}
      {mayEdit && (
        <Button
          variant="outlined"
          startIcon={<EditOutlined />}
          aria-label={`Upravit měření ${formatDay(measurementDate(s))}`}
          onClick={(e) => { e.stopPropagation(); setEditing(s); }}
          sx={{ minHeight: 44, alignSelf: 'stretch' }}
        >
          Upravit
        </Button>
      )}
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
        open={entering || editing !== null}
        onClose={closeDialog}
        fullScreen={phone}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {editing !== null ? 'Upravit naměřené hodnoty' : 'Zapsat naměřené hodnoty'}
          <IconButton aria-label="Zavřít" onClick={closeDialog} sx={{ width: 44, height: 44 }}>
            <Close />
          </IconButton>
        </DialogTitle>
        {/* No shell bottom bar over a dialog: the pinned save button sits at the edge. */}
        <DialogContent sx={{ '--bottom-bar-height': '0px', bgcolor: 'background.default' }}>
          <ManualResultsForm
            key={editing?.id ?? 'new'}
            patientId={id}
            {...(editing !== null ? { session: editing } : {})}
            onCancel={closeDialog}
            onSaved={() => { closeDialog(); void query.refetch(); }}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
