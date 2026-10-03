import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Grid, Button, TextField, MenuItem, Stack } from '@mui/material';
import { Add } from '@mui/icons-material';
import { injuriesApi } from '../api/injuries';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { FilterChips, KpiCard, PageHeader, StatusChip, type ChipTone } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useIsPhone } from '../layout/useDevice';
import { FormDialog } from './sports/FormDialog';
import { ListSkeleton, LoadError } from './sports/LoadStates';
import { ScrollChips } from './sports/ScrollChips';
import { useTouchSx } from './sports/touch';
import toast from 'react-hot-toast';

interface Injury {
  id: string;
  patientId: string;
  patientName?: string;
  injuryDate: string;
  bodyRegion: string;
  specificLocation: string;
  side: string;
  type: string;
  severity: number;
  status: string;
  mechanism: string;
  diagnosis: string;
  practitioner: string;
  estimatedDaysOut?: number;
  actualDaysOut?: number;
  isRecurrence: boolean;
  clearedAt?: string;
}

const bodyRegions = [
  { value: 'Head', label: 'Hlava' }, { value: 'Neck', label: 'Krk' },
  { value: 'Shoulder', label: 'Rameno' }, { value: 'UpperArm', label: 'Horní paže' },
  { value: 'Elbow', label: 'Loket' }, { value: 'Forearm', label: 'Předloktí' },
  { value: 'Wrist', label: 'Zápěstí' }, { value: 'Hand', label: 'Ruka' },
  { value: 'UpperBack', label: 'Horní záda' }, { value: 'LowerBack', label: 'Dolní záda' },
  { value: 'Hip', label: 'Kyčel' }, { value: 'Thigh', label: 'Stehno' },
  { value: 'Knee', label: 'Koleno' }, { value: 'Shin', label: 'Lýtko' },
  { value: 'Ankle', label: 'Hlezno' }, { value: 'Foot', label: 'Chodidlo' },
];
const severityLabels = ['', 'Mírné', 'Střední', 'Vážné', 'Kritické'];
const severityTones: ChipTone[] = ['grey', 'green', 'beige', 'red', 'red'];
const statusLabels: Record<string, string> = {
  Acute: 'Akutní', Rehabilitating: 'Rehabilitace', ReturningToPlay: 'Návrat do hry',
  Cleared: 'Vyléčeno', Chronic: 'Chronické',
};
const statusTones: Record<string, ChipTone> = {
  Acute: 'red', Rehabilitating: 'beige', ReturningToPlay: 'blue',
  Cleared: 'green', Chronic: 'grey',
};

type InjuryFilter = 'all' | 'active' | 'cleared';

const regionLabel = (injury: Injury): string =>
  bodyRegions.find(r => r.value === injury.bodyRegion)?.label || injury.bodyRegion;
const sideLabel = (side: string): string => (side === 'Left' ? 'Levá' : side === 'Right' ? 'Pravá' : 'Obě');
const dateOf = (injury: Injury): string => new Date(injury.injuryDate).toLocaleDateString('cs-CZ');
const daysOut = (injury: Injury): string => {
  const days = injury.actualDaysOut ?? injury.estimatedDaysOut;
  return days === undefined || days === null ? '—' : `${days} dní`;
};

const emptyForm = () => ({
  patientId: '', bodyRegion: '', specificLocation: '', side: 'Left',
  type: 'Acute', severity: 1, mechanism: '', diagnosis: '', practitioner: '',
  injuryDate: new Date().toISOString().slice(0, 10), notes: '', isRecurrence: false,
  estimatedDaysOut: '',
});

export default function Injuries() {
  const phone = useIsPhone();
  const touch = useTouchSx();
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<InjuryFilter>('all');

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    injuriesApi.getAll()
      .then(setInjuries)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.patientId || !form.bodyRegion) {
      toast.error('Vyplňte pacienta a tělesnou oblast');
      return;
    }
    try {
      const estimatedDays = form.estimatedDaysOut ? parseInt(form.estimatedDaysOut, 10) : undefined;
      const newInjury = await injuriesApi.create({
        patientId: form.patientId,
        bodyRegion: form.bodyRegion,
        specificLocation: form.specificLocation,
        side: form.side,
        type: form.type,
        severity: form.severity,
        mechanism: form.mechanism,
        diagnosis: form.diagnosis,
        practitioner: form.practitioner,
        injuryDate: form.injuryDate,
        notes: form.notes,
        isRecurrence: form.isRecurrence,
        estimatedDaysOut: estimatedDays,
      });
      setInjuries(prev => [newInjury, ...prev]);
      setOpen(false);
      toast.success('Záznam poranění vytvořen');
      setSelectedPatient(null);
      setForm(emptyForm());
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Neznámá chyba — zkontrolujte připojení k backendu';
      toast.error(`Chyba při ukládání: ${msg}`);
    }
  };

  const activeInjuries = injuries.filter(i => i.status !== 'Cleared');
  const clearedInjuries = injuries.filter(i => i.status === 'Cleared');
  const avgDaysOut = clearedInjuries.length > 0
    ? Math.round(clearedInjuries.reduce((a, i) => a + (i.actualDaysOut || 0), 0) / clearedInjuries.length)
    : 0;

  const shown = filter === 'active' ? activeInjuries : filter === 'cleared' ? clearedInjuries : injuries;

  const columns: DataColumn<Injury>[] = [
    { key: 'date', header: 'Datum', tablet: true, cell: (i) => <Box sx={{ whiteSpace: 'nowrap' }}>{dateOf(i)}</Box> },
    {
      key: 'region', header: 'Oblast', tablet: true,
      cell: (i) => (
        <>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{regionLabel(i)}</Typography>
          {i.specificLocation && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{i.specificLocation}</Typography>
          )}
        </>
      ),
    },
    { key: 'side', header: 'Strana', cell: (i) => sideLabel(i.side) },
    {
      key: 'severity', header: 'Závažnost',
      cell: (i) => <StatusChip tone={severityTones[i.severity] ?? 'grey'}>{severityLabels[i.severity]}</StatusChip>,
    },
    {
      key: 'status', header: 'Stav', tablet: true,
      cell: (i) => <StatusChip tone={statusTones[i.status] ?? 'grey'}>{statusLabels[i.status] || i.status}</StatusChip>,
    },
    { key: 'diagnosis', header: 'Diagnóza', cell: (i) => i.diagnosis || '—' },
    { key: 'days', header: 'Dny mimo', align: 'right', cell: (i) => daysOut(i) },
  ];

  const newButton = (
    <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={touch}>
      Nové poranění
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title="Poranění"
        subtitle={`Evidence a sledování poranění sportovců · ${injuries.length} záznamů`}
        actions={phone ? undefined : newButton}
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard label="Aktivní poranění" value={activeInjuries.length} hint="v léčbě nebo rehabilitaci" tone={activeInjuries.length > 0 ? 'red' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <KpiCard label="Vyléčeno" value={clearedInjuries.length} hint="uzavřených záznamů" tone="green" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <KpiCard label="Průměr dnů mimo" value={avgDaysOut} hint="u vyléčených poranění" />
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <ScrollChips>
          <FilterChips<InjuryFilter>
            ariaLabel="Filtr poranění"
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'Všechna', count: injuries.length },
              { key: 'active', label: 'Aktivní', count: activeInjuries.length },
              { key: 'cleared', label: 'Vyléčená', count: clearedInjuries.length },
            ]}
          />
        </ScrollChips>
      </Box>

      {loading ? (
        <ListSkeleton rows={5} height={phone ? 96 : 56} />
      ) : failed ? (
        <LoadError what="Poranění" onRetry={load} />
      ) : (
        <ResponsiveDataList
          ariaLabel="Poranění"
          rows={shown}
          rowKey={(i) => i.id}
          columns={columns}
          empty={
            injuries.length === 0
              ? 'Žádná poranění zatím neevidována'
              : 'V tomto filtru nejsou žádná poranění'
          }
          renderCard={(i) => (
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                    {regionLabel(i)} · {sideLabel(i.side).toLowerCase()}
                  </Typography>
                  {i.specificLocation && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{i.specificLocation}</Typography>
                  )}
                </Box>
                <StatusChip tone={statusTones[i.status] ?? 'grey'}>{statusLabels[i.status] || i.status}</StatusChip>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                <StatusChip tone={severityTones[i.severity] ?? 'grey'} size="sm">{severityLabels[i.severity]}</StatusChip>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {dateOf(i)} · {daysOut(i)} mimo
                </Typography>
              </Stack>
              {i.diagnosis && <Typography variant="body2">{i.diagnosis}</Typography>}
            </Stack>
          )}
        />
      )}

      {phone && <PinnedActionBar label="Nové poranění">{newButton}</PinnedActionBar>}

      {/* Add Dialog */}
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nový záznam poranění"
        actions={
          <>
            <Button variant="outlined" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button variant="contained" onClick={handleSubmit}>Vytvořit</Button>
          </>
        }
      >
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12 }}>
            <PatientPicker
              required
              value={selectedPatient}
              onChange={(patient) => {
                setSelectedPatient(patient);
                update('patientId', patient?.id || '');
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label="Tělesná oblast" value={form.bodyRegion}
              onChange={e => update('bodyRegion', e.target.value)}>
              {bodyRegions.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label="Strana" value={form.side}
              onChange={e => update('side', e.target.value)}>
              <MenuItem value="Left">Levá</MenuItem>
              <MenuItem value="Right">Pravá</MenuItem>
              <MenuItem value="Bilateral">Obě</MenuItem>
              <MenuItem value="Central">Centrální</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Specifické místo" value={form.specificLocation}
              onChange={e => update('specificLocation', e.target.value)}
              placeholder="např. mediální kolaterální vaz" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label="Typ" value={form.type}
              onChange={e => update('type', e.target.value)}>
              <MenuItem value="Acute">Akutní</MenuItem>
              <MenuItem value="Overuse">Přetížení</MenuItem>
              <MenuItem value="Recurrence">Recidiva</MenuItem>
              <MenuItem value="FirstOccurrence">První výskyt</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label="Závažnost" value={form.severity}
              onChange={e => update('severity', parseInt(e.target.value))}>
              <MenuItem value={1}>1 — Mírné</MenuItem>
              <MenuItem value={2}>2 — Střední</MenuItem>
              <MenuItem value={3}>3 — Vážné</MenuItem>
              <MenuItem value={4}>4 — Kritické</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline rows={2} label="Mechanismus poranění" value={form.mechanism}
              onChange={e => update('mechanism', e.target.value)}
              placeholder="např. kontakt s protihráčem při sprintu" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Diagnóza" value={form.diagnosis}
              onChange={e => update('diagnosis', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Ošetřující praktik" value={form.practitioner}
              onChange={e => update('practitioner', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth type="number" label="Odhad dnů mimo" value={form.estimatedDaysOut}
              onChange={e => update('estimatedDaysOut', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline rows={2} label="Poznámky" value={form.notes}
              onChange={e => update('notes', e.target.value)} />
          </Grid>
        </Grid>
      </FormDialog>
    </Box>
  );
}
