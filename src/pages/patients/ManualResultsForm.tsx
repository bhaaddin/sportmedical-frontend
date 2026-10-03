/*
 * Zapsat naměřené hodnoty - the doctor's manual entry of a measurement.
 *
 * One page, not a wizard: somebody who has the printout next to them types it
 * from top to bottom and saves. It saves through the only write that exists,
 * `POST /api/v1/diagnostics/sessions`; the values that endpoint has no column
 * for travel in the notes (see `manualResults.ts`, which also validates).
 *
 * Phone: one field per row and the save button pinned at the bottom. Tablet and
 * desktop: fields in a grid that makes as many columns as fit.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, IconButton, InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import { Add, DeleteOutlined } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { diagnosticsApi } from '../../api/diagnostics';
import type { DiagnosticSession } from '../../api/diagnostics';
import { activitiesApi } from '../../api/activities';
import type { Patient } from '../../api/patients';
import PatientPicker from '../../components/patients/PatientPicker';
import { SectionLabel, SoftCard } from '../../components/ui';
import { PinnedActionBar } from '../../components/ui/PinnedActionBar';
import { useIsPhone } from '../../layout/useDevice';
import { pragueDateKey } from '../../utils/time';
import { emptyManualDraft, toSessionRequest } from './manualResults';
import type { ManualDraft, ManualErrors } from './manualResults';

const FIELD_GRID = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(220px, 1fr))' }, gap: 2 } as const;

/** The signed-in doctor's name, to save typing it on every entry. */
function storedPractitioner(): string {
  try {
    const raw = window.localStorage.getItem('user');
    if (raw === null) return '';
    const user = JSON.parse(raw) as { firstName?: string; lastName?: string };
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  } catch {
    return '';
  }
}

export interface ManualResultsFormProps {
  /** When the screen already knows the patient (their card), no picker is drawn. */
  patientId?: string;
  onSaved?: (session: DiagnosticSession) => void;
  onCancel?: () => void;
}

export default function ManualResultsForm({ patientId, onSaved, onCancel }: ManualResultsFormProps) {
  const phone = useIsPhone();
  const [draft, setDraft] = useState<ManualDraft>(() =>
    emptyManualDraft(patientId ?? '', storedPractitioner(), pragueDateKey(new Date().toISOString())));
  const [patient, setPatient] = useState<Patient | null>(null);
  const [errors, setErrors] = useState<ManualErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  /* The protocol types are the clinic's own činnosti - nothing is hard-coded
     here, and a failed load just leaves the field free text. */
  const activities = useQuery({
    queryKey: ['activities', 'list'],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60_000,
  });
  const protocolOptions = useMemo(
    () => (activities.data?.activities ?? []).map((a) => a.name),
    [activities.data],
  );

  const set = <K extends keyof ManualDraft>(key: K, value: ManualDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const text = (key: keyof ManualDraft, label: string, unit?: string, opts: { required?: boolean } = {}) => (
    <TextField
      key={key}
      label={label}
      required={opts.required}
      value={String(draft[key])}
      onChange={(e) => set(key, e.target.value as never)}
      error={errors[key] !== undefined}
      helperText={errors[key]}
      slotProps={{
        htmlInput: { inputMode: unit === undefined ? 'text' : 'decimal' },
        input: {
          sx: { minHeight: 44 },
          endAdornment: unit === undefined ? undefined : <InputAdornment position="end">{unit}</InputAdornment>,
        },
      }}
    />
  );

  const save = async () => {
    const result = toSessionRequest(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setFailure('');
      return;
    }
    setErrors({});
    setSaving(true);
    setFailure('');
    try {
      const session = await diagnosticsApi.create(result.request);
      toast.success('Naměřené hodnoty uloženy.');
      onSaved?.(session);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFailure(message ?? 'Hodnoty se nepodařilo uložit. Zkuste to znovu.');
    } finally {
      setSaving(false);
    }
  };

  const updateZone = (i: number, patch: Partial<ManualDraft['zones'][number]>) =>
    set('zones', draft.zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));

  const problems = Object.keys(errors).length;

  return (
    <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} data-layout={phone ? 'one-column' : 'grid'}>
      {problems > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {problems === 1 ? 'Jedno pole je potřeba opravit.' : `Je potřeba opravit ${problems} ${problems < 5 ? 'pole' : 'polí'}.`}
        </Alert>
      )}
      {failure !== '' && <Alert severity="error" sx={{ mb: 2 }}>{failure}</Alert>}

      <Stack spacing={2}>
        <SoftCard>
          <SectionLabel>Měření</SectionLabel>
          <Box sx={FIELD_GRID}>
            {patientId === undefined && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <PatientPicker
                  value={patient}
                  onChange={(p) => { setPatient(p); set('patientId', p?.id ?? ''); }}
                  label="Pacient"
                  required
                />
                {errors.patientId !== undefined && (
                  <Typography variant="caption" sx={{ color: 'error.main' }}>{errors.patientId}</Typography>
                )}
              </Box>
            )}
            {text('practitionerName', 'Lékař', undefined, { required: true })}
            <TextField
              label="Datum měření"
              type="date"
              value={draft.measuredOn}
              onChange={(e) => set('measuredOn', e.target.value)}
              error={errors.measuredOn !== undefined}
              helperText={errors.measuredOn}
              slotProps={{ inputLabel: { shrink: true }, input: { sx: { minHeight: 44 } } }}
            />
            <Autocomplete
              freeSolo
              options={protocolOptions}
              inputValue={draft.protocol}
              onInputChange={(_, value) => set('protocol', value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Typ protokolu"
                  slotProps={{ ...params.slotProps, input: { ...params.slotProps.input, sx: { minHeight: 44 } } }}
                />
              )}
            />
            {text('device', 'Přístroj')}
          </Box>
        </SoftCard>

        <SoftCard>
          <SectionLabel>Srdce a výkon</SectionLabel>
          <Box sx={FIELD_GRID}>
            {text('vo2MaxMlMinKg', 'VO₂max', 'ml/kg/min', { required: true })}
            {text('restingHeartRateBpm', 'Klidový tep', 'bpm', { required: true })}
            {text('maxHeartRateBpm', 'Max. tep', 'bpm', { required: true })}
            {text('anaerobicThresholdBpm', 'Tep anaerobního prahu', 'bpm', { required: true })}
            {text('thresholdPercentVo2', 'Práh v % VO₂max', '%')}
            {text('maxPowerW', 'Max. výkon', 'W')}
            {text('powerPerKg', 'Výkon na kg', 'W/kg')}
          </Box>
        </SoftCard>

        <SoftCard>
          <SectionLabel>Tělo a tlak</SectionLabel>
          <Box sx={FIELD_GRID}>
            {text('weightKg', 'Hmotnost', 'kg')}
            {text('bodyFatPercentage', 'Tělesný tuk', '%', { required: true })}
            {text('muscleMassKg', 'Svalová hmota', 'kg', { required: true })}
            {text('systolicBloodPressure', 'Systolický tlak', 'mmHg', { required: true })}
            {text('diastolicBloodPressure', 'Diastolický tlak', 'mmHg', { required: true })}
          </Box>
        </SoftCard>

        <SoftCard>
          <SectionLabel>Tréninkové zóny</SectionLabel>
          {draft.zones.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Zóny jsou volitelné. Přidejte je, pokud je přístroj vypsal.
            </Typography>
          )}
          <Stack spacing={1.5}>
            {draft.zones.map((zone, i) => (
              <Box
                key={i}
                data-testid="training-zone"
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr auto' }, gap: 1.5, alignItems: 'start' }}
              >
                <TextField
                  label={`Zóna ${i + 1}`}
                  value={zone.name}
                  onChange={(e) => updateZone(i, { name: e.target.value })}
                  error={errors[`zone.${i}.name`] !== undefined}
                  helperText={errors[`zone.${i}.name`]}
                  slotProps={{ input: { sx: { minHeight: 44 } } }}
                />
                <TextField
                  label={`Zóna ${i + 1} od`}
                  value={zone.fromBpm}
                  onChange={(e) => updateZone(i, { fromBpm: e.target.value })}
                  error={errors[`zone.${i}.range`] !== undefined}
                  helperText={errors[`zone.${i}.range`]}
                  slotProps={{ htmlInput: { inputMode: 'decimal' }, input: { sx: { minHeight: 44 }, endAdornment: <InputAdornment position="end">bpm</InputAdornment> } }}
                />
                <TextField
                  label={`Zóna ${i + 1} do`}
                  value={zone.toBpm}
                  onChange={(e) => updateZone(i, { toBpm: e.target.value })}
                  slotProps={{ htmlInput: { inputMode: 'decimal' }, input: { sx: { minHeight: 44 }, endAdornment: <InputAdornment position="end">bpm</InputAdornment> } }}
                />
                <IconButton
                  aria-label={`Odebrat zónu ${i + 1}`}
                  onClick={() => set('zones', draft.zones.filter((_, idx) => idx !== i))}
                  sx={{ width: 44, height: 44 }}
                >
                  <DeleteOutlined />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Button
            startIcon={<Add />}
            onClick={() => set('zones', [...draft.zones, { name: '', fromBpm: '', toBpm: '' }])}
            sx={{ mt: 1.5, minHeight: 44 }}
          >
            Přidat zónu
          </Button>
        </SoftCard>

        <SoftCard>
          <SectionLabel>Poznámky</SectionLabel>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Poznámky lékaře"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Hodnoty bez vlastního pole (datum měření, přístroj, protokol, výkon, hmotnost, zóny) se uloží do poznámek
            měření a zobrazí se v jeho detailu.
          </Typography>
        </SoftCard>
      </Stack>

      <PinnedActionBar label="Uložit naměřené hodnoty">
        {onCancel !== undefined && (
          <Button variant="outlined" onClick={onCancel} disabled={saving} sx={{ minHeight: 44 }}>
            Zrušit
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={saving} sx={{ minHeight: 44 }}>
          {saving ? 'Ukládám…' : 'Uložit hodnoty'}
        </Button>
      </PinnedActionBar>
    </Box>
  );
}
