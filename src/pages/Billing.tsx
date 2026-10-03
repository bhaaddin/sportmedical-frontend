/*
 * Fakturace - doklady, platby a přehled tržeb, laid out as on the design board
 * (screen 18): four numbers, a search with filters, one table.
 *
 * "Hotově na místě" is the money taken at the desk this month, read off the
 * payments each invoice lists; "Kluby" appears once an invoice carries a club.
 * A row opens into its payments. The page can be entered with a `state`
 * (see `billing/invoicePrefill`): from a visit, from a club, or from a link to
 * one document - and then the new-document dialog is already filled in.
 */
import { Fragment, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Chip, Grid, TextField, MenuItem, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, Skeleton, InputAdornment, Collapse, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Stack,
} from '@mui/material';
import { Add, ExpandLess, ExpandMore, Search } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { billingApi } from '../api/billing';
import type { Invoice, InvoicePaymentMethod } from '../api/billing';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { activitiesApi } from '../api/activities';
import { calendarsApi } from '../api/calendars';
import { clubsApi } from '../api/clubs';
import { partnerOrdersApi } from '../api/partnerOrders';
import PatientPicker from '../components/patients/PatientPicker';
import { NumberSeriesPreview } from '../components/NumberSeriesPreview';
import { PageHeader, KpiCard, FilterChips, StatusChip, SectionLabel } from '../components/ui';
import type { FilterOption } from '../components/ui';
import { czk, czDate } from './billing/money';
import {
  doklady, isClub, isOpen, itemsLabel, matchesFilter, matchesSearch, monthIn, monthYear,
  statusOf, summarize, customerOf, PAYMENT_METHOD_LABEL,
} from './billing/invoiceView';
import type { InvoiceFilter } from './billing/invoiceView';
import InvoicePayments from './billing/InvoicePayments';
import { addLine, hasPrefill, linesFromActivities, readNavState } from './billing/invoicePrefill';
import type { BillingNavState, DraftLine } from './billing/invoicePrefill';

type SortKey = 'invoiceNumber' | 'customer' | 'issueDateUtc' | 'totalCzk' | 'status';

const PAYMENT_METHODS: { value: InvoicePaymentMethod; label: string }[] = (
  Object.keys(PAYMENT_METHOD_LABEL) as InvoicePaymentMethod[]
).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }));

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
  /* Where the document comes from, when another screen sent it here. */
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [club, setClub] = useState<{ id: string; name: string } | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payment, setPayment] = useState<{ amount: string; method: InvoicePaymentMethod; note: string }>({
    amount: '', method: 'Cash', note: '',
  });
  /* The row opened into its payments. */
  const [openId, setOpenId] = useState<string | null>(null);
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
  const [lines, setLines] = useState<DraftLine[]>([]);

  const resetDraft = () => {
    setCreateDialogOpen(false);
    setNewInvoice({ patientId: '', serviceId: '', notes: '' });
    setInvoicePatient(null);
    setAppointmentId(null);
    setClub(null);
    setLines([]);
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice.patientId || lines.length === 0) return;
    try {
      const inv = await billingApi.createInvoice({
        patientId: newInvoice.patientId,
        serviceId: lines[0].serviceId,
        notes: newInvoice.notes,
        ...(appointmentId !== null ? { appointmentId } : {}),
        ...(club !== null ? { clubId: club.id } : {}),
      });
      /* The server adds one unit per call, so 12x is the first one plus eleven. */
      let failed = 0;
      for (let i = 0; i < lines.length; i++) {
        const extra = i === 0 ? lines[i].quantity - 1 : lines[i].quantity;
        for (let n = 0; n < extra; n++) {
          try {
            await billingApi.addLineItem(inv.id, lines[i].serviceId);
          } catch { failed += 1; }
        }
      }
      if (failed > 0) toast.error(`Doklad vystaven, ale ${failed} položek se nepodařilo přidat`);
      else toast.success('Doklad vystaven');
      resetDraft();
      await reload();
    } catch {
      toast.error('Doklad se nepodařilo vystavit');
    }
  };

  const toggleService = (serviceId: string) => {
    setLines((prev) =>
      prev.some((l) => l.serviceId === serviceId)
        ? prev.filter((l) => l.serviceId !== serviceId)
        : addLine(prev, serviceId),
    );
  };

  const setQuantity = (serviceId: string, raw: string) => {
    const quantity = Math.max(1, Math.min(200, Math.floor(Number(raw)) || 1));
    setLines((prev) => prev.map((l) => (l.serviceId === serviceId ? { ...l, quantity } : l)));
  };

  const invoiceTotal = useMemo(() => {
    return lines.reduce(
      (sum, l) => sum + (services.find((s) => s.id === l.serviceId)?.priceCzk ?? 0) * l.quantity,
      0,
    );
  }, [services, lines]);

  /* ── Entered from another screen ── */
  const location = useLocation();
  const navigate = useNavigate();
  const entered = useRef(false);

  const applyPrefill = useCallback(async (state: BillingNavState) => {
    if (state.invoiceId !== undefined) setOpenId(state.invoiceId);
    if (state.patientId === undefined && state.clubId === undefined && state.appointmentId === undefined
      && state.activityId === undefined && state.partnerOrderId === undefined) return;

    setCreateDialogOpen(true);
    if (state.appointmentId !== undefined) setAppointmentId(state.appointmentId);
    if (state.patientId !== undefined) {
      patientsApi.getById(state.patientId)
        .then((patient) => {
          setInvoicePatient(patient);
          setNewInvoice((p) => ({ ...p, patientId: patient.id }));
        })
        .catch(() => toast.error('Pacienta se nepodařilo načíst'));
    }
    if (state.clubId !== undefined) {
      clubsApi.getById(state.clubId)
        .then((c) => setClub({ id: c.id, name: c.name }))
        .catch(() => toast.error('Klub se nepodařilo načíst'));
    }
    if (state.activityId === undefined && state.partnerOrderId === undefined) return;

    try {
      const wanted: { activityId: string; count: number }[] = [];
      if (state.activityId !== undefined) wanted.push({ activityId: state.activityId, count: 1 });
      if (state.partnerOrderId !== undefined) {
        const calendars = await calendarsApi.list();
        const lists = await Promise.allSettled(calendars.map((c) => partnerOrdersApi.list(c.id)));
        const order = lists
          .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
          .find((o) => o.id === state.partnerOrderId);
        for (const item of order?.items ?? []) {
          wanted.push({ activityId: item.activityId, count: Math.max(1, item.requestedCount) });
        }
      }
      const { activities } = await activitiesApi.list();
      const { lines: found, unpriced } = linesFromActivities(wanted, activities);
      setLines((prev) => found.reduce((acc, l) => addLine(acc, l.serviceId, l.quantity), prev));
      if (unpriced > 0) toast.error('Některá činnost nemá v ceníku položku - přidejte ji ručně');
    } catch {
      toast.error('Položky z objednávky se nepodařilo načíst - vyberte je z ceníku');
    }
  }, []);

  useEffect(() => {
    if (loading || entered.current) return;
    const state = readNavState(location.state);
    if (!hasPrefill(state)) return;
    entered.current = true;
    /* Spent: a reload must not open the dialog again. */
    navigate(location.pathname, { replace: true, state: null });
    void applyPrefill(state);
  }, [loading, location.state, location.pathname, navigate, applyPrefill]);

  /* A link to one document brings it into view. */
  useEffect(() => {
    if (openId === null || loading) return;
    document.getElementById(`invoice-${openId}`)?.scrollIntoView?.({ block: 'center' });
  }, [openId, loading]);

  /* ── Record payment ── */
  const openPayment = (inv: Invoice) => {
    setPayment({ amount: String(inv.remainingCzk), method: isClub(inv) ? 'Transfer' : 'Cash', note: '' });
    setPaying(inv);
  };

  const paymentAmount = Number(payment.amount.replace(/[\s ]/g, '').replace(',', '.'));
  const paymentValid = Number.isFinite(paymentAmount) && paymentAmount > 0;

  const handleRecordPayment = async () => {
    if (paying === null || !paymentValid) return;
    setSavingPayment(true);
    try {
      const note = payment.note.trim();
      await billingApi.recordPayment(paying.id, {
        amountCzk: paymentAmount,
        method: payment.method,
        ...(note !== '' ? { note } : {}),
      });
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
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
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
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label={`Vyfakturováno ${monthIn(now)}`}
            value={czk(stats.invoicedThisMonth)}
            hint={doklady(stats.invoicedThisMonthCount)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Nezaplaceno"
            value={czk(stats.unpaid)}
            tone={stats.unpaid > 0 ? 'red' : 'ink'}
            hint={`${doklady(stats.overdueCount)} po splatnosti`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Hotově na místě"
            value={czk(stats.cashThisMonth)}
            hint={`kartou ${czk(stats.cardThisMonth)}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
              const open = openId === inv.id;
              return (
                <Fragment key={inv.id}>
                <TableRow id={`invoice-${inv.id}`} hover selected={open}>
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
                    <IconButton
                      size="small"
                      onClick={() => setOpenId(open ? null : inv.id)}
                      aria-expanded={open}
                      aria-label={`Platby dokladu ${inv.invoiceNumber}`}
                      sx={{ ml: 0.5 }}
                    >
                      {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                      <Box sx={{ py: 1.5 }}>
                        <InvoicePayments invoice={inv} />
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
                </Fragment>
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
              {club !== null && (
                <Chip
                  color="primary"
                  label={`Klub: ${club.name}`}
                  onDelete={() => setClub(null)}
                  sx={{ mb: 1.5 }}
                />
              )}
              <PatientPicker
                label={club !== null ? 'Pacient (kontakt klubu)' : undefined}
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
                    color={lines.some((l) => l.serviceId === s.id) ? 'primary' : 'default'}
                    variant={lines.some((l) => l.serviceId === s.id) ? 'filled' : 'outlined'}
                  />
                ))}
                {services.filter(s => s.isActive).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Ceník je prázdný.</Typography>
                )}
              </Box>
              {lines.length > 0 && (
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {lines.map((l) => {
                    const item = services.find((s) => s.id === l.serviceId);
                    return (
                      <Stack key={l.serviceId} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{item?.name ?? 'Položka ceníku'}</Typography>
                        <TextField
                          size="small"
                          type="number"
                          label="Počet"
                          value={l.quantity}
                          onChange={(e) => setQuantity(l.serviceId, e.target.value)}
                          slotProps={{ htmlInput: { min: 1, max: 200, 'aria-label': `Počet ${item?.name ?? ''}` } }}
                          sx={{ width: 96 }}
                        />
                        <Typography variant="body2" sx={{ width: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {czk((item?.priceCzk ?? 0) * l.quantity)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
              {lines.length > 0 && (
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
          <Button variant="outlined" onClick={resetDraft}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreateInvoice}
            disabled={!newInvoice.patientId || lines.length === 0}>
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
              <TextField
                label="Poznámka"
                value={payment.note}
                onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))}
                slotProps={{ htmlInput: { maxLength: 200 } }}
                fullWidth
              />
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
