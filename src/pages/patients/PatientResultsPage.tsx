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
 * Shelves (docs/ui-shelf-system.md): Poslední sezení (four figures against the
 * session before), Sezení (a card per measurement on a phone, a three-column
 * table on an iPad, the full table on a desktop; "Zapsat hodnoty ručně" and
 * "Nové měření" in its header).
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
import { diagnosticsApi } from '../../api/diagnostics';
import type { DiagnosticSession } from '../../api/diagnostics';
import { StatusChip } from '../../components/ui';
import { MetricCard, Shelf, TARGET_SX } from '../../ui/shelf';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { usePermission } from '../../auth/usePermission';
import { useIsPhone } from '../../layout/useDevice';
import { formatPragueDate } from '../../utils/time';
import ManualResultsForm from './ManualResultsForm';
import SessionValues from './results/SessionValues';
import { measurementDate } from './results/measuredValues';
import { ExportGate } from '../../components/ui/ExportGate';

/** A yyyy-MM-dd day, or an instant read in the clinic's zone. */
const formatDay = (value: string): string => {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return plain !== null ? `${Number(plain[3])}. ${Number(plain[2])}. ${plain[1]}` : formatPragueDate(value);
};

/** One decimal, the Czech way ("52,5"). */
const decimal = (n: number): string => n.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "+3,2 % oproti minule", or null when there is no earlier session to compare with (or it would not be a number). */
export function trendPct(current: number, previous: number | undefined): string | null {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return null;
  return `${pct > 0 ? '+' : ''}${decimal(pct)} % oproti minule`;
}

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
    await diagnosticsApi.downloadPdf(session.id); // shows its own failure, the refusal in Czech
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
              sx={TARGET_SX}
            >
              Upravit
            </Button>
          )}
          <ExportGate>
            {(blocked) => (
              <Button size="small" variant="outlined" disabled={blocked} onClick={() => void openReport(s)} sx={TARGET_SX}>
                Otevřít zprávu
              </Button>
            )}
          </ExportGate>
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
      <ExportGate>
        {(blocked) => (
          <Button
            variant="outlined"
            disabled={blocked}
            onClick={(e) => { e.stopPropagation(); void openReport(s); }}
            sx={{ minHeight: 44, alignSelf: 'stretch' }}
          >
            Otevřít zprávu
          </Button>
        )}
      </ExportGate>
    </Stack>
  );

  const latest = sessions[0];
  const previous = sessions[1];
  const newMeasurement = () => navigate(`/diagnostics/new?patientId=${id}`);
  const actions = (
    <Stack direction="row" spacing={1} sx={{ '& .MuiButton-root': { ...TARGET_SX, minHeight: phone ? 44 : undefined } }}>
      <Button size="small" variant="outlined" onClick={() => setEntering(true)}>
        Zapsat hodnoty ručně
      </Button>
      <Button size="small" variant="contained" onClick={newMeasurement}>
        Nové měření
      </Button>
    </Stack>
  );

  return (
    <Stack spacing={3} data-shelf-section="vysledky">
      {/* ── Poslední sezení: the four numbers a person asks for first, against the time before ── */}
      {latest !== undefined && (
        <Shelf
          id="latest"
          title="Poslední sezení"
          hint={`Měřeno ${formatDay(measurementDate(latest))}`}
          layout="row"
          fill
          minCardWidth={180}
          phoneWidth="min(44vw, 200px)"
          stagger={false}
        >
          <MetricCard label="VO₂ max" value={decimal(latest.vo2MaxMlMinKg)} hint={trendPct(latest.vo2MaxMlMinKg, previous?.vo2MaxMlMinKg) ?? 'ml/min/kg'} />
          <MetricCard label="Klidový tep" value={`${latest.restingHeartRateBpm}`} hint={trendPct(latest.restingHeartRateBpm, previous?.restingHeartRateBpm) ?? 'úderů/min'} />
          <MetricCard label="Krevní tlak" value={`${latest.systolicBloodPressure}/${latest.diastolicBloodPressure}`} hint="mmHg" />
          <MetricCard label="Tělesný tuk" value={`${decimal(latest.bodyFatPercentage)} %`} hint={`Svaly ${decimal(latest.muscleMassKg)} kg`} />
        </Shelf>
      )}

      {/* ── Sezení: every measurement, newest first; the two ways to add one sit in its header ── */}
      <Shelf
        id="sessions"
        title="Sezení"
        hint="Diagnostická měření, od nejnovějšího"
        count={query.isLoading || query.isError ? undefined : sessions.length}
        layout="free"
        stagger={false}
        controls={actions}
        loading={query.isLoading}
        error={query.isError ? 'Výsledky se nepodařilo načíst.' : false}
        onRetry={() => void query.refetch()}
        empty={sessions.length === 0}
        /* The two ways to add one are in the header, right above: not drawn twice. */
        emptyState={{ text: 'Zatím tu žádný výsledek není.' }}
      >
        <ResponsiveDataList
          rows={sessions}
          rowKey={(s) => s.id}
          columns={columns}
          renderCard={renderCard}
          ariaLabel="Výsledky měření"
        />
      </Shelf>

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
