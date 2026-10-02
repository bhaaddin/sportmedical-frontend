/*
 * Fakturace - doklady, platby a přehled tržeb, laid out as on the design board
 * (screen 18): four numbers, a search with filters, one table.
 *
 * The board's third card, "HOTOVĚ NA MÍSTĚ - vybral lékař", is not drawn:
 * InvoiceDto carries how much was paid but not how. The card comes back the
 * day the API says which payments were cash. The "Kluby" filter likewise
 * appears only once an invoice in the list carries a club.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Chip, Grid, TextField, MenuItem, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, Skeleton, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Stack,
} from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { billingApi } from '../api/billing';
import type { Invoice, InvoicePaymentMethod } from '../api/billing';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { NumberSeriesPreview } from '../components/NumberSeriesPreview';
import { PageHeader, KpiCard, FilterChips, StatusChip, SectionLabel } from '../components/ui';
import type { FilterOption } from '../components/ui';
import { czk, czDate } from './billing/money';
import {
  doklady, isClub, isOpen, itemsLabel, matchesFilter, matchesSearch, monthIn, monthYear,
  statusOf, summarize, customerOf,
} from './billing/invoiceView';
import type { InvoiceFilter } from './billing/invoiceView';

type SortKey = 'invoiceNumber' | 'customer' | 'issueDateUtc' | 'totalCzk' | 'status';

const PAYMENT_METHODS: { value: InvoicePaymentMethod; label: string }[] = [
  { value: 'Cash', label: 'Hotově' },
  { value: 'Card', label: 'Kartou' },
  { value: 'Transfer', label: 'Převodem' },
  { value: 'ClubBilling', label: 'Na klub' },
];

export default function Billing() {
  /* ── Data ── */
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);

  /* ── Filters ── */
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('issueDateUtc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /* ── Dialogs ── */
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ patientId: '', serviceId: '', notes: '' });
  const [invoicePatient, setInvoicePatient] = useState<Patient | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payment, setPayment] = useState<{ amount: string; method: InvoicePaymentMethod }>({ amount: '', method: 'Cash' });
  const [savingPayment, setSavingPayment] = useState(false);

  const now = useMemo(() => new Date(), []);

  const reload = useCallback(async () => {
    const refreshed = await billingApi.getInvoices();
    setInvoices(refreshed);
  }, []);

  /* ── Fetch data ── */
  useEffect(() => {
    Promise.all([
      billingApi.getInvoices().catch(() => []),
      servicesApi.getAll().catch(() => []),
    ]).then(([inv, srv]) => {
      setInvoices(inv);
      setServices(srv);
    }).finally(() => setLoading(false));
  }, []);

  const hasClubs = useMemo(() => invoices.some(isClub), [invoices]);

  /* ── Filtered & sorted data ── */
  const filteredInvoices = useMemo(() => {
    const result = invoices.filter((inv) => matchesSearch(inv, search) && matchesFilter(inv, filter, now));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'totalCzk':
          return (a.totalCzk - b.totalCzk) * dir;
        case 'issueDateUtc':
          return (new Date(a.issueDateUtc).getTime() - new Date(b.issueDateUtc).getTime()) * dir;
        case 'customer':
          return customerOf(a).localeCompare(customerOf(b), 'cs') * dir;
        case 'status':
          return statusOf(a, now).label.localeCompare(statusOf(b, now).label, 'cs') * dir;
        default:
          return (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '', 'cs') * dir;
      }
    });
  }, [invoices, search, filter, sortBy, sortDir, now]);

  /* ── KPI stats ── */
  const stats = useMemo(() => summarize(invoices, now), [invoices, now]);

  const handleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'issueDateUtc' || col === 'totalCzk' ? 'desc' : 'asc');
    }
  };

  /* ── Create invoice ── */
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleCreateInvoice = async () => {
    if (!newInvoice.patientId || selectedServices.length === 0) return;
    try {
      const inv = await billingApi.createInvoice({
        patientId: newInvoice.patientId,
        serviceId: selectedServices[0],
        notes: newInvoice.notes,
      });
      /* Add additional services as line items */
      for (let i = 1; i < selectedServices.length; i++) {
        try {
          await billingApi.addLineItem(inv.id, selectedServices[i]);
        } catch { /* skip failed line items */ }
      }
      toast.success('Doklad vystaven');
      setCreateDialogOpen(false);
      setNewInvoice({ patientId: '', serviceId: '', notes: '' });
      setInvoicePatient(null);
      setSelectedServices([]);
      await reload();
    } catch {
      toast.error('Doklad se nepodařilo vystavit');
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(s => s !== serviceId) : [...prev, serviceId]
    );
  };

  const invoiceTotal = useMemo(() => {
    return services
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + (s.priceCzk || 0), 0);
  }, [services, selectedServices]);

  /* ── Record payment ── */
  const openPayment = (inv: Invoice) => {
    setPayment({ amount: String(inv.remainingCzk), method: isClub(inv) ? 'Transfer' : 'Cash' });
    setPaying(inv);
  };

  const paymentAmount = Number(payment.amount.replace(/[\s ]/g, '').replace(',', '.'));
  const paymentValid = Number.isFinite(paymentAmount) && paymentAmount > 0;

  const handleRecordPayment = async () => {
    if (paying === null || !paymentValid) return;
    setSavingPayment(true);
    try {
      await billingApi.recordPayment(paying.id, { amount: paymentAmount, method: payment.method });
      toast.success('Platba zaevidována');
      setPaying(null);
      await reload();
    } catch {
      toast.error('Platbu se nepodařilo zaevidovat');
    } finally {
      setSavingPayment(false);
    }
  };

  const filterOptions: FilterOption<InvoiceFilter>[] = [
    { key: 'all', label: 'Vše' },
    { key: 'unpaid', label: 'Nezaplacené' },
    { key: 'overdue', label: 'Po splatnosti' },
    ...(hasClubs ? [{ key: 'clubs' as const, label: 'Kluby' }] : []),
  ];

  const header = (
    <PageHeader
      title="Fakturace"
      subtitle="Doklady, platby a přehled tržeb"
      actions={
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}>
          Nový doklad
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <Box>
        {header}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={96} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={320} />
      </Box>
    );
  }

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'invoiceNumber', label: 'Číslo' },
    { key: 'customer', label: 'Odběratel' },
    { key: 'issueDateUtc', label: 'Datum' },
    { key: 'totalCzk', label: 'Částka', align: 'right' },
    { key: 'status', label: 'Stav' },
  ];

  return (
    <Box>
      {header}

      {/* ── KPI cards ── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            label={`Vyfakturováno ${monthIn(now)}`}
            value={czk(stats.invoicedThisMonth)}
            hint={doklady(stats.invoicedThisMonthCount)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            label="Nezaplaceno"
            value={czk(stats.unpaid)}
            tone={stats.unpaid > 0 ? 'red' : 'ink'}
            hint={`${doklady(stats.overdueCount)} po splatnosti`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            label="Průměr na pacienta"
            value={stats.averagePerPatient === null ? '—' : czk(stats.averagePerPatient)}
            hint={monthYear(now)}
          />
        </Grid>
      </Grid>

      {/* ── Search + filters ── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' } }}>
        <TextField
          fullWidth
          placeholder="Číslo dokladu, pacient nebo klub"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: {
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
          } }}
          sx={{ flex: 1 }}
        />
        <FilterChips options={filterOptions} value={filter} onChange={setFilter} ariaLabel="Filtr dokladů" />
      </Stack>

      {/* ── Invoice table ── */}
      <TableContainer component={Paper} sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.slice(0, 2).map((col) => (
                <TableCell key={col.key} sortDirection={sortBy === col.key ? sortDir : false}>
                  <TableSortLabel active={sortBy === col.key} direction={sortBy === col.key ? sortDir : 'asc'} onClick={() => handleSort(col.key)}>
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell>Položky</TableCell>
              {columns.slice(2).map((col) => (
                <TableCell key={col.key} align={col.align} sortDirection={sortBy === col.key ? sortDir : false}>
                  <TableSortLabel active={sortBy === col.key} direction={sortBy === col.key ? sortDir : 'asc'} onClick={() => handleSort(col.key)}>
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInvoices.map((inv) => {
              const st = statusOf(inv, now);
              const club = isClub(inv);
              return (
                <TableRow key={inv.id} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{inv.invoiceNumber}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {club ? (
                      inv.clubName
                    ) : inv.patientId ? (
                      <Link
                        component={RouterLink}
                        to={`/patients/${inv.patientId}`}
                        underline="hover"
                        sx={{ color: 'primary.main', fontWeight: 600 }}
                      >
                        {inv.patientName || 'Pacient'}
                      </Link>
                    ) : (
                      inv.patientName
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" noWrap title={itemsLabel(inv)}>{itemsLabel(inv)}</Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{czDate(inv.issueDateUtc)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {czk(inv.totalCzk)}
                    {inv.status === 'PartiallyPaid' && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        zbývá {czk(inv.remainingCzk)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><StatusChip tone={st.tone}>{st.label}</StatusChip></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {isOpen(inv) && (
                      <Button size="small" variant="outlined" onClick={() => openPayment(inv)} aria-label={`Přijmout platbu ${inv.invoiceNumber}`}>
                        Přijmout platbu
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary' }}>
                    {invoices.length === 0 ? 'Zatím žádné doklady.' : 'Žádný doklad neodpovídá hledání.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Zobrazeno {filteredInvoices.length} z {doklady(invoices.length)}
          </Typography>
        </Box>
      </TableContainer>

      {/* ── Create invoice dialog ── */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nový doklad</DialogTitle>
        <DialogContent>
          {createDialogOpen && (
            <Box sx={{ mb: 2 }}>
              <NumberSeriesPreview documentType="FA" />
            </Box>
          )}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <SectionLabel>Odběratel</SectionLabel>
              <PatientPicker
                value={invoicePatient}
                onChange={(patient) => {
                  setInvoicePatient(patient);
                  setNewInvoice((p) => ({ ...p, patientId: patient?.id ?? '' }));
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <SectionLabel>Položky z ceníku</SectionLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 200, overflow: 'auto', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                {services.filter(s => s.isActive).map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.name} — ${czk(s.priceCzk)}`}
                    onClick={() => toggleService(s.id)}
                    color={selectedServices.includes(s.id) ? 'primary' : 'default'}
                    variant={selectedServices.includes(s.id) ? 'filled' : 'outlined'}
                  />
                ))}
                {services.filter(s => s.isActive).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Ceník je prázdný.</Typography>
                )}
              </Box>
              {selectedServices.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                  Celkem k úhradě {czk(invoiceTotal)}
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Poznámka" value={newInvoice.notes}
                onChange={(e) => setNewInvoice((p) => ({ ...p, notes: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setCreateDialogOpen(false); setSelectedServices([]); }}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreateInvoice}
            disabled={!newInvoice.patientId || selectedServices.length === 0}>
            Vystavit doklad
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Record payment dialog ── */}
      <Dialog open={paying !== null} onClose={savingPayment ? undefined : () => setPaying(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Přijmout platbu</DialogTitle>
        <DialogContent>
          {paying !== null && (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {paying.invoiceNumber} · {customerOf(paying)} · zbývá {czk(paying.remainingCzk)}
              </Typography>
              <TextField
                label="Částka"
                value={payment.amount}
                onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
                error={payment.amount !== '' && !paymentValid}
                helperText={payment.amount !== '' && !paymentValid ? 'Zadejte částku v Kč.' : undefined}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }}
                fullWidth
              />
              <TextField
                select
                label="Způsob platby"
                value={payment.method}
                onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value as InvoicePaymentMethod }))}
                fullWidth
              >
                {PAYMENT_METHODS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setPaying(null)} disabled={savingPayment}>Zrušit</Button>
          <Button variant="contained" onClick={handleRecordPayment} disabled={savingPayment || !paymentValid}>
            {savingPayment ? 'Ukládám…' : 'Zaevidovat platbu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
