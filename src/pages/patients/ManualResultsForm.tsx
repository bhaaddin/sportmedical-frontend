/*
 * Zapsat naměřené hodnoty - the doctor's manual entry of a measurement, and
 * the edit of one that is already stored.
 *
 * One page, not a wizard: somebody who has the printout next to them types it
 * from top to bottom and saves. Every value goes to its own field of the
 * session (contract C-M) - nothing is written into the doctor's notes. A new
 * entry saves with `POST /api/v1/diagnostics/sessions`; given a `session` the
 * form opens prefilled and saves with `PUT .../{id}`. A refusal from the
 * server is shown at the field it names (`manualResults.serverFieldErrors`).
 *
 * Protocol type and device are free text; what is suggested is what the
 * clinic has already used on this patient's sessions (and its činnosti) - no
 * list lives in the code. "Výkon na kg" is computed by the server; here it is
 * only a live hint and is never sent.
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
import type { CreateSessionRequest, DiagnosticSession } from '../../api/diagnostics';
import { activitiesApi } from '../../api/activities';
import type { Patient } from '../../api/patients';
import PatientPicker from '../../components/patients/PatientPicker';
import { SectionLabel, SoftCard } from '../../components/ui';
import { PinnedActionBar } from '../../components/ui/PinnedActionBar';
import { useIsPhone } from '../../layout/useDevice';
import { pragueDateKey } from '../../utils/time';
import {
  LIMITS, MAX_TRAINING_ZONES, draftFromSession, emptyManualDraft, powerPerKgHint, serverFieldErrors,
  toSessionRequest, toUpdateRequest,
} from './manualResults';
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

const distinct = (values: Array<string | null | undefined>): string[] => {
  const seen = new Map<string, string>();
  for (const v of values) {
    const t = typeof v === 'string' ? v.trim() : '';
    if (t !== '' && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'cs'));
};

export interface ManualResultsFormProps {
  /** When the screen already knows the patient (their card), no picker is drawn. */
  patientId?: string;
  /** A stored session to edit: the form opens prefilled and saves with PUT. */
  session?: DiagnosticSession;
  onSaved?: (session: DiagnosticSession) => void;
  onCancel?: () => void;
}

export default function ManualResultsForm({ patientId, session, onSaved, onCancel }: ManualResultsFormProps) {
  const phone = useIsPhone();
  const editing = session !== undefined;
  const [draft, setDraft] = useState<ManualDraft>(() =>
    session !== undefined
      ? draftFromSession(session)
      : emptyManualDraft(patientId ?? '', storedPractitioner(), pragueDateKey(new Date().toISOString())));
  const [patient, setPatient] = useState<Patient | null>(null);
  const [errors, setErrors] = useState<ManualErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  /* What the clinic has already used: this patient's sessions, and its činnosti.
     A failed load just leaves the fields free text. */
  const lookupPatient = session?.patientId ?? patientId ?? draft.patientId;
  const history = useQuery({
    queryKey: ['patient', lookupPatient, 'diagnostic-sessions'],
    queryFn: () => diagnosticsApi.getByPatient(lookupPatient),
    enabled: lookupPatient !== '',
    staleTime: 60_000,
  });
  const activities = useQuery({
    queryKey: ['activities', 'list'],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60_000,
  });
  const protocolOptions = useMemo(
    () => distinct([...(history.data ?? []).map((s) => s.protocolType), ...(activities.data?.activities ?? []).map((a) => a.name)]),
    [history.data, activities.data],
  );
  const deviceOptions = useMemo(
    () => distinct((history.data ?? []).map((s) => s.device)),
    [history.data],
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

  const suggested = (key: 'protocol' | 'device', label: string, options: string[]) => (
    <Autocomplete
      freeSolo
      options={options}
      inputValue={draft[key]}
      onInputChange={(_, value) => set(key, value)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={errors[key] !== undefined}
          helperText={errors[key]}
          slotProps={{
            ...params.slotProps,
            input: { ...params.slotProps.input, sx: { minHeight: 44 } },
          }}
        />
      )}
    />
  );

  const save = async () => {
    setFailure('');
    const built = editing ? toUpdateRequest(draft) : toSessionRequest(draft);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = session !== undefined
        ? await diagnosticsApi.update(session.id, built.request)
        : await diagnosticsApi.create(built.request as CreateSessionRequest);
      toast.success(editing ? 'Změny uloženy.' : 'Naměřené hodnoty uloženy.');
      onSaved?.(saved);
    } catch (err) {
      const refused = serverFieldErrors(err);
      setErrors(refused.errors);
      setFailure(
        refused.message
          ?? (Object.keys(refused.errors).length > 0 ? '' : 'Hodnoty se nepodařilo uložit. Zkuste to znovu.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const updateZone = (i: number, patch: Partial<ManualDraft['zones'][number]>) =>
    set('zones', draft.zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));

  const problems = Object.keys(errors).length;
  const perKg = powerPerKgHint(draft.maxPowerW, draft.weightKg);
  const zonesFull = draft.zones.length >= MAX_TRAINING_ZONES;

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
            {patientId === undefined && !editing && (
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
            {suggested('protocol', 'Typ protokolu', protocolOptions)}
            {suggested('device', 'Přístroj', deviceOptions)}
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
            <Box data-testid="power-per-kg" aria-live="polite" sx={{ alignSelf: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Výkon na kg</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {perKg === null ? '—' : `${String(perKg).replace('.', ',')} W/kg`}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Vypočítá se z výkonu a hmotnosti, nezadává se.
              </Typography>
            </Box>
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
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,2fr) auto' }, gap: 1.5, alignItems: 'start' }}
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
                <TextField
                  label={`Zóna ${i + 1} poznámka`}
                  value={zone.note}
                  onChange={(e) => updateZone(i, { note: e.target.value })}
                  error={errors[`zone.${i}.note`] !== undefined}
                  helperText={errors[`zone.${i}.note`]}
                  slotProps={{ input: { sx: { minHeight: 44 } } }}
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
          {errors.zones !== undefined && (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1 }}>{errors.zones}</Typography>
          )}
          <Button
            startIcon={<Add />}
            disabled={zonesFull}
            onClick={() => set('zones', [...draft.zones, { name: '', fromBpm: '', toBpm: '', note: '' }])}
            sx={{ mt: 1.5, minHeight: 44 }}
          >
            Přidat zónu
          </Button>
          {zonesFull && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Zón je nejvýše {MAX_TRAINING_ZONES}.
            </Typography>
          )}
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
            error={errors.notes !== undefined}
            helperText={errors.notes}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Poznámky jsou jen pro lékaře. Naměřené hodnoty se ukládají do vlastních polí, ne sem.
          </Typography>
        </SoftCard>
      </Stack>

      <PinnedActionBar label={editing ? 'Uložit změny měření' : 'Uložit naměřené hodnoty'}>
        {onCancel !== undefined && (
          <Button variant="outlined" onClick={onCancel} disabled={saving} sx={{ minHeight: 44 }}>
            Zrušit
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={saving} sx={{ minHeight: 44 }}>
          {saving ? 'Ukládám…' : editing ? 'Uložit změny' : 'Uložit hodnoty'}
        </Button>
      </PinnedActionBar>
    </Box>
  );
}
