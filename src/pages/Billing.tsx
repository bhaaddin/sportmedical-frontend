/*
 * Fakturace - doklady, platby a přehled tržeb, laid out as on the design board
 * (screen 18): the numbers, a search with filters, the list of invoices.
 *
 * Three layouts: a phone gets one card per invoice, an iPad a table with fewer
 * columns, a desktop the full table. A document is made out to a person, a
 * group or a team; above the manual-discount limit it waits for approval, and
 * somebody with `billing.approve` approves or rejects it here.
 *
 * "Hotově na místě" is the money taken at the desk this month, read off the
 * payments each invoice lists. A row opens into its discounts and payments.
 * The page can be entered with a `state` (see `billing/invoicePrefill`): from a
 * visit, from a club, from a club block, or from a link to one document.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Paper, Skeleton,
  Stack, TextField, Typography,
} from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { billingApi } from '../api/billing';
import type { Invoice, InvoicePaymentMethod } from '../api/billing';
import { toBookingError } from '../api/apiError';
import { usePermissions } from '../auth/usePermission';
import { useDevice } from '../layout/useDevice';
import { PageHeader, KpiCard, FilterChips } from '../components/ui';
import type { FilterOption } from '../components/ui';
import InvoiceCards from '../components/billing/InvoiceCards';
import InvoiceTable from '../components/billing/InvoiceTable';
import type { InvoiceSortKey } from '../components/billing/InvoiceTable';
import type { InvoiceActionHandlers } from '../components/billing/InvoiceActions';
import NewInvoiceFlow from '../components/billing/NewInvoiceFlow';
import RejectInvoiceDialog from '../components/billing/RejectInvoiceDialog';
import { czk } from './billing/money';
import {
  doklady, isClub, matchesFilter, matchesSearch, monthIn, monthYear, statusOf, summarize, customerOf,
  PAYMENT_METHOD_LABEL,
} from './billing/invoiceView';
import type { InvoiceFilter } from './billing/invoiceView';
import { hasPrefill, readNavState, wantsNewInvoice } from './billing/invoicePrefill';
import type { BillingNavState } from './billing/invoicePrefill';
import { openPdfBlob, pdfFileName } from './billing/openPdf';

/** The permission that lets somebody approve or reject an invoice above a discount limit. */
const APPROVE_PERMISSION = 'billing.approve';

const PAYMENT_METHODS: { value: InvoicePaymentMethod; label: string }[] = (
  Object.keys(PAYMENT_METHOD_LABEL) as InvoicePaymentMethod[]
).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }));

const messageOf = (error: unknown, fallback: string): string => toBookingError(error).serverMessage ?? fallback;

export default function Billing() {
  const device = useDevice();
  const phone = device === 'phone';
  const tablet = device === 'tablet';
  const canApprove = usePermissions().includes(APPROVE_PERMISSION);

  /* ── Data ── */
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  /* ── Filters ── */
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [sortBy, setSortBy] = useState<InvoiceSortKey>('issueDateUtc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /* ── Dialogs ── */
  /* `null` closed; otherwise what the new-document flow was opened with. */
  const [flow, setFlow] = useState<{ nav: BillingNavState | null } | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payment, setPayment] = useState<{ amount: string; method: InvoicePaymentMethod; note: string }>({
    amount: '', method: 'Cash', note: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [rejecting, setRejecting] = useState<Invoice | null>(null);
  /* The invoice an approve / reject / PDF request is running for. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /* The row opened into its discounts and payments. */
  const [openId, setOpenId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);

  const reload = useCallback(async () => {
    setInvoices(await billingApi.getInvoices());
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    billingApi.getInvoices()
      .then(setInvoices)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const handleSort = (col: InvoiceSortKey) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'issueDateUtc' || col === 'totalCzk' ? 'desc' : 'asc');
    }
  };

  /* ── Entered from another screen ── */
  const location = useLocation();
  const navigate = useNavigate();
  const entered = useRef(false);

  useEffect(() => {
    if (loading || entered.current) return;
    const state = readNavState(location.state);
    if (!hasPrefill(state)) return;
    entered.current = true;
    /* Spent: a reload must not open the dialog again. */
    navigate(location.pathname, { replace: true, state: null });
    if (state.invoiceId !== undefined) setOpenId(state.invoiceId);
    if (wantsNewInvoice(state)) setFlow({ nav: state });
  }, [loading, location.state, location.pathname, navigate]);

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
    } catch (error) {
      toast.error(messageOf(error, 'Platbu se nepodařilo zaevidovat'));
    } finally {
      setSavingPayment(false);
    }
  };

  /* ── Approve, reject, PDF ── */
  const handleApprove = async (inv: Invoice) => {
    setBusyId(inv.id);
    try {
      await billingApi.approve(inv.id);
      toast.success('Doklad schválen');
      await reload();
    } catch (error) {
      toast.error(messageOf(error, 'Doklad se nepodařilo schválit'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (rejecting === null) return;
    setBusyId(rejecting.id);
    try {
      await billingApi.reject(rejecting.id, reason);
      toast.success('Doklad zamítnut');
      setRejecting(null);
      await reload();
    } catch (error) {
      toast.error(messageOf(error, 'Doklad se nepodařilo zamítnout'));
    } finally {
      setBusyId(null);
    }
  };

  const handlePdf = async (inv: Invoice) => {
    setBusyId(inv.id);
    try {
      openPdfBlob(await billingApi.getInvoicePdf(inv.id), pdfFileName(inv.invoiceNumber));
    } catch {
      toast.error('PDF se nepodařilo načíst');
    } finally {
      setBusyId(null);
    }
  };

  const handlers: InvoiceActionHandlers = {
    canApprove,
    busyId,
    onPay: openPayment,
    onApprove: (inv) => void handleApprove(inv),
    onReject: setRejecting,
    onPdf: (inv) => void handlePdf(inv),
  };

  const filterOptions: FilterOption<InvoiceFilter>[] = [
    { key: 'all', label: 'Vše' },
    { key: 'unpaid', label: 'Nezaplacené' },
    { key: 'overdue', label: 'Po splatnosti' },
    { key: 'clubs', label: 'Kluby' },
    {
      key: 'approval',
      label: 'Ke schválení',
      ...(stats.pendingApprovalCount > 0 ? { count: stats.pendingApprovalCount } : {}),
    },
  ];
  /* A club filter on a clinic that never billed a club is just noise on a phone. */
  const visibleFilters = phone && !hasClubs ? filterOptions.filter((o) => o.key !== 'clubs') : filterOptions;

  const header = (
    <PageHeader
      title="Fakturace"
      subtitle="Doklady, platby a přehled tržeb"
      actions={
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setFlow({ nav: null })}
          sx={phone ? { minHeight: 44 } : undefined}
        >
          Nový doklad
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <Box>
        {header}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mb: 2.5 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={320} />
      </Box>
    );
  }

  if (loadFailed) {
    return (
      <Box>
        {header}
        <Paper variant="outlined" role="alert" sx={{ p: 3, display: 'grid', gap: 1.5, justifyItems: 'start' }}>
          <Typography sx={{ fontWeight: 700 }}>Doklady se nepodařilo načíst.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Server neodpověděl. Zkontrolujte připojení a zkuste to znovu.
          </Typography>
          <Button variant="contained" onClick={load} sx={phone ? { minHeight: 44 } : undefined}>Zkusit znovu</Button>
        </Paper>
        <NewInvoiceFlow open={flow !== null} nav={flow?.nav ?? null} onClose={() => setFlow(null)} onCreated={() => load()} />
      </Box>
    );
  }

  const emptyText = invoices.length === 0 ? 'Zatím žádné doklady.' : 'Žádný doklad neodpovídá hledání.';

  return (
    <Box>
      {header}

      {/* ── KPI cards: 2×2 on a phone ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: canApprove ? 'repeat(auto-fit, minmax(190px, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 1.5, md: 2 },
          mb: 2.5,
        }}
      >
        <KpiCard
          label={`Vyfakturováno ${monthIn(now)}`}
          value={czk(stats.invoicedThisMonth)}
          hint={doklady(stats.invoicedThisMonthCount)}
        />
        <KpiCard
          label="Nezaplaceno"
          value={czk(stats.unpaid)}
          tone={stats.unpaid > 0 ? 'red' : 'ink'}
          hint={`${doklady(stats.overdueCount)} po splatnosti`}
        />
        <KpiCard
          label="Hotově na místě"
          value={czk(stats.cashThisMonth)}
          hint={`kartou ${czk(stats.cardThisMonth)}`}
        />
        <KpiCard
          label="Průměr na pacienta"
          value={stats.averagePerPatient === null ? '—' : czk(stats.averagePerPatient)}
          hint={monthYear(now)}
        />
        {canApprove && (
          <KpiCard
            label="Ke schválení"
            value={String(stats.pendingApprovalCount)}
            tone={stats.pendingApprovalCount > 0 ? 'primary' : 'ink'}
            hint="nad limitem ruční slevy"
          />
        )}
      </Box>

      {/* ── Search + filters (the chips scroll sideways on a phone) ── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' } }}>
        <TextField
          fullWidth
          placeholder="Číslo dokladu, pacient nebo klub"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> },
            htmlInput: { 'aria-label': 'Hledat doklad' },
          }}
          sx={{ flex: 1, ...(phone ? { '& .MuiInputBase-root': { minHeight: 44 } } : {}) }}
        />
        <Box
          sx={
            phone
              ? {
                  overflowX: 'auto',
                  mx: -2,
                  px: 2,
                  pb: 0.5,
                  '& [role="group"]': { flexWrap: 'nowrap', width: 'max-content' },
                  '& .MuiButtonBase-root': { minHeight: 44, flexShrink: 0 },
                }
              : undefined
          }
        >
          <FilterChips options={visibleFilters} value={filter} onChange={setFilter} ariaLabel="Filtr dokladů" />
        </Box>
      </Stack>

      {/* ── Invoices ── */}
      {phone ? (
        <InvoiceCards
          invoices={filteredInvoices}
          now={now}
          openId={openId}
          onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
          handlers={handlers}
          empty={emptyText}
        />
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <InvoiceTable
              invoices={filteredInvoices}
              now={now}
              compact={tablet}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              openId={openId}
              onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
              handlers={handlers}
              empty={emptyText}
            />
          </Box>
          <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Zobrazeno {filteredInvoices.length} z {doklady(invoices.length)}
            </Typography>
          </Box>
        </Paper>
      )}
      {phone && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>
          Zobrazeno {filteredInvoices.length} z {doklady(invoices.length)}
        </Typography>
      )}

      {/* ── New document ── */}
      <NewInvoiceFlow
        open={flow !== null}
        nav={flow?.nav ?? null}
        onClose={() => setFlow(null)}
        onCreated={() => { void reload().catch(() => toast.error('Seznam dokladů se nepodařilo obnovit')); }}
      />

      {/* ── Reject ── */}
      <RejectInvoiceDialog
        invoice={rejecting}
        busy={busyId !== null && busyId === rejecting?.id}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => void handleReject(reason)}
      />

      {/* ── Record payment dialog ── */}
      <Dialog
        open={paying !== null}
        onClose={savingPayment ? undefined : () => setPaying(null)}
        maxWidth="xs"
        fullWidth
        fullScreen={phone}
        sx={phone ? { '& .MuiInputBase-root': { minHeight: 44 }, '& .MuiButton-root': { minHeight: 44 } } : undefined}
      >
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
        <DialogActions sx={phone ? { px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' } : undefined}>
          <Button variant="outlined" onClick={() => setPaying(null)} disabled={savingPayment}>Zrušit</Button>
          <Button variant="contained" onClick={handleRecordPayment} disabled={savingPayment || !paymentValid}>
            {savingPayment ? 'Ukládám…' : 'Zaevidovat platbu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
