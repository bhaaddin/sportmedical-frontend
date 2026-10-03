import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Grid, Button, TextField, MenuItem, Stack } from '@mui/material';
import { PersonAdd } from '@mui/icons-material';
import { availabilityApi, type Availability } from '../api/availability';
import { FilterChips, KpiCard, PageHeader, StatusChip, type ChipTone } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useIsPhone } from '../layout/useDevice';
import { FormDialog } from './sports/FormDialog';
import { ListSkeleton, LoadError } from './sports/LoadStates';
import { ScrollChips } from './sports/ScrollChips';
import { useTouchSx } from './sports/touch';
import toast from 'react-hot-toast';

const statusConfig: Record<string, { label: string; tone: ChipTone }> = {
  Available: { label: 'K dispozici', tone: 'green' },
  Modified: { label: 'Omezený', tone: 'beige' },
  Unavailable: { label: 'Nedostupný', tone: 'red' },
  Suspended: { label: 'Vyloučen', tone: 'grey' },
};

type StatusFilter = 'all' | keyof typeof statusConfig;

const viewOf = (a: Availability) => statusConfig[a.status] || statusConfig.Available;
const nameOf = (a: Availability) => a.patientName || a.patientId.slice(0, 8);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ');

export default function Availability() {
  const phone = useIsPhone();
  const touch = useTouchSx();
  const [athletes, setAthletes] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', status: 'Available', reason: '', expectedReturnDate: '' });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    availabilityApi.getAll()
      .then(setAthletes)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.patientId) { toast.error('Zadejte ID pacienta'); return; }
    try {
      const newAvail = await availabilityApi.create({
        patientId: form.patientId,
        status: form.status,
        reason: form.reason,
        expectedReturnDate: form.expectedReturnDate || undefined,
        updatedBy: 'System',
      });
      setAthletes(p => [newAvail, ...p]);
      setOpen(false);
      toast.success('Sportovec přidán');
      setForm({ patientId: '', status: 'Available', reason: '', expectedReturnDate: '' });
    } catch { toast.error('Chyba při přidávání'); }
  };

  const count = (status: string) => athletes.filter(a => a.status === status).length;
  const available = count('Available');
  const unavailable = count('Unavailable');
  const modified = count('Modified');
  const shown = filter === 'all' ? athletes : athletes.filter(a => a.status === filter);

  const columns: DataColumn<Availability>[] = [
    { key: 'name', header: 'Sportovec', tablet: true, cell: (a) => <Box sx={{ fontSize: 15, fontWeight: 600 }}>{nameOf(a)}</Box> },
    { key: 'status', header: 'Stav', tablet: true, cell: (a) => <StatusChip tone={viewOf(a).tone}>{viewOf(a).label}</StatusChip> },
    { key: 'reason', header: 'Důvod', cell: (a) => a.reason || '—' },
    {
      key: 'return', header: 'Návrat', tablet: true,
      cell: (a) => (a.expectedReturnDate ? <Box sx={{ whiteSpace: 'nowrap' }}>{dateOf(a.expectedReturnDate)}</Box> : '—'),
    },
    { key: 'updated', header: 'Zapsáno', cell: (a) => `${dateOf(a.date)} · ${a.updatedBy}` },
  ];

  const addButton = (
    <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setOpen(true)} sx={touch}>
      Přidat
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title="Dostupnost sportovců"
        subtitle="Kdo může trénovat a závodit"
        actions={phone ? undefined : addButton}
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="K dispozici" value={available} tone="green" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Nedostupní" value={unavailable} tone={unavailable > 0 ? 'red' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Omezení" value={modified} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Celkem" value={athletes.length} hint="záznamů o dostupnosti" />
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <ScrollChips>
          <FilterChips<StatusFilter>
            ariaLabel="Filtr dostupnosti"
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'Všichni', count: athletes.length },
              { key: 'Available', label: 'K dispozici', count: available },
              { key: 'Modified', label: 'Omezení', count: modified },
              { key: 'Unavailable', label: 'Nedostupní', count: unavailable },
              { key: 'Suspended', label: 'Vyloučení', count: count('Suspended') },
            ]}
          />
        </ScrollChips>
      </Box>

      {loading ? (
        <ListSkeleton rows={5} height={phone ? 110 : 56} />
      ) : failed ? (
        <LoadError what="Dostupnost sportovců" onRetry={load} />
      ) : (
        <ResponsiveDataList
          ariaLabel="Dostupnost sportovců"
          rows={shown}
          rowKey={(a) => a.id}
          columns={columns}
          empty={
            athletes.length === 0 ? (
              <>
                <Typography sx={{ fontWeight: 600 }}>Žádné záznamy o dostupnosti</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Přidejte prvního sportovce tlačítkem „Přidat“.
                </Typography>
              </>
            ) : (
              'V tomto filtru nikdo není.'
            )
          }
          renderCard={(a) => (
            <>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nameOf(a)}
                </Typography>
                <StatusChip tone={viewOf(a).tone}>{viewOf(a).label}</StatusChip>
              </Stack>
              {a.reason && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{a.reason}</Typography>}
              {a.expectedReturnDate && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Návrat: <Box component="strong">{dateOf(a.expectedReturnDate)}</Box>
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                {dateOf(a.date)} · {a.updatedBy}
              </Typography>
            </>
          )}
        />
      )}

      {phone && <PinnedActionBar label="Přidat sportovce">{addButton}</PinnedActionBar>}

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Přidat sportovce"
        actions={
          <>
            <Button variant="outlined" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button variant="contained" onClick={handleAdd}>Přidat</Button>
          </>
        }
      >
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12 }}><TextField fullWidth label="ID pacienta" value={form.patientId} onChange={e => update('patientId', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth select label="Stav" value={form.status} onChange={e => update('status', e.target.value)}>
              <MenuItem value="Available">K dispozici</MenuItem>
              <MenuItem value="Modified">Omezený</MenuItem>
              <MenuItem value="Unavailable">Nedostupný</MenuItem>
              <MenuItem value="Suspended">Vyloučen</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth label="Důvod" value={form.reason} onChange={e => update('reason', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth type="date" label="Očekávaný návrat" value={form.expectedReturnDate} onChange={e => update('expectedReturnDate', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
        </Grid>
      </FormDialog>
    </Box>
  );
}
