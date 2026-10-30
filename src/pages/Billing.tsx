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
 * visit, from a club, from a club block, or from a link to one document; and
 * with `{ filter }` (an attention card's "show them all").
 *
 * Built as shelves (docs/ui-shelf-system.md): the frame with "Nový doklad", the
 * month's figures, "Vyžaduje pozornost" (overdue invoices - the same `isOverdue`
 * as the filter - and, for an approver, the ones waiting for approval; drawn only
 * when there is something), and the invoices themselves, a shelf that takes the
 * height that is left and scrolls inside. An opened invoice shows what it is
 * connected to (`invoiceRelatedGroups`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Paper,
  Stack, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { Add, Close, Search } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { billingApi } from '../api/billing';
import type { Invoice, InvoicePaymentMethod } from '../api/billing';
import { toBookingError } from '../api/apiError';
import { usePermissions } from '../auth/usePermission';
import { useDevice } from '../layout/useDevice';
import { FilterChips } from '../components/ui';
import type { FilterOption } from '../components/ui';
import InvoiceCards from '../components/billing/InvoiceCards';
import InvoiceTable from '../components/billing/InvoiceTable';
import type { InvoiceSortKey } from '../components/billing/InvoiceTable';
import type { InvoiceActionHandlers } from '../components/billing/InvoiceActions';
import NewInvoiceFlow from '../components/billing/NewInvoiceFlow';
import RejectInvoiceDialog from '../components/billing/RejectInvoiceDialog';
import { czk } from './billing/money';
import {
  doklady, filterFromState, isClub, matchesFilter, matchesPatient, matchesSearch, patientFilterFromState, monthIn, monthYear, statusOf, summarize, customerOf,
  PAYMENT_METHOD_LABEL,
} from './billing/invoiceView';
import type { InvoiceFilter } from './billing/invoiceView';
import { hasPrefill, readNavState, wantsNewInvoice } from './billing/invoicePrefill';
import type { BillingNavState } from './billing/invoicePrefill';
import { pdfFileName } from './billing/openPdf';
import { download } from '../utils/download';
import { FIT_FILL_SX, STICKY_HEAD_SX } from '../components/ui/fit';
import { AttentionCard, MetricCard, PageFrame, Shelf } from '../ui/shelf';
import type { AttentionGroup } from '../ui/shelf';
import { invoiceApprovals, overdueInvoices } from '../ui/shelf/attention';

/** The permission that lets somebody approve or reject an invoice above a discount limit. */
const APPROVE_PERMISSION = 'billing.approve';

const PAYMENT_METHODS: { value: InvoicePaymentMethod; label: string }[] = (
  Object.keys(PAYMENT_METHOD_LABEL) as InvoicePaymentMethod[]
).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }));

const messageOf = (error: unknown, fallback: string): string => toBookingError(error).serverMessage ?? fallback;

/*
 * An attention card on this page is its count, its sentence and one button that applies the filter: the cases themselves
 * are the table right under it, so listing them twice would only push the table off the screen (R18: few, strong blocks).
 */

export default function Billing() {
  const device = useDevice();
  const phone = device === 'phone';
  /* The seven-column table needs about 1180 px beside the sidebar (a 1440 window has that); narrower, it folds into five columns. */
  const narrow = useMediaQuery('(max-width: 1439px)');
  const tablet = device === 'tablet' || narrow;
  const canApprove = usePermissions().includes(APPROVE_PERMISSION);

  /* ── Data ── */
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  /* ── Filters ── */
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  /* A patient's "Otevřít ve Fakturaci": the list narrowed to that patient until the chip is removed. */
  const [patientFilter, setPatientFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<InvoiceSortKey>('issueDateUtc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /* ── Dialogs ── */
  /* `null` closed; otherwise what the new-document flow was opened with. */
  const [flow, setFlow] = useState<{ nav: BillingNavState | null } | null>(null);
  /* The prefill of a document that was opened and not yet issued: closing the flow keeps it, issuing clears it. */
  const [unfinished, setUnfinished] = useState<BillingNavState | null>(null);
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

  const patientFilterName = useMemo(
    () => (patientFilter === null ? '' : invoices.find((inv) => inv.patientId === patientFilter)?.patientName ?? ''),
    [invoices, patientFilter],
  );

  const hasClubs = useMemo(() => invoices.some(isClub), [invoices]);

  /* ── Filtered & sorted data ── */
  const filteredInvoices = useMemo(() => {
    const result = invoices.filter((inv) => matchesSearch(inv, search) && matchesFilter(inv, filter, now) && matchesPatient(inv, patientFilter));
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
  }, [invoices, search, filter, patientFilter, sortBy, sortDir, now]);

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

  /* ── Entered from another screen (or from an attention card on this one) ── */
  const location = useLocation();
  const navigate = useNavigate();
  /* The navigation already acted on: a card on this page links here again, so this runs per navigation, not once. */
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (loading || handled.current === location.key) return;
    const state = readNavState(location.state);
    const askedFilter = filterFromState(location.state);
    const askedPatient = patientFilterFromState(location.state);
    if (!hasPrefill(state) && askedFilter === null && askedPatient === null) return;
    handled.current = location.key;
    /* Spent: a reload must not open the dialog again. */
    navigate(location.pathname, { replace: true, state: null });
    if (askedFilter !== null) setFilter(askedFilter);
    if (askedPatient !== null) { setPatientFilter(askedPatient); setSearch(''); }
    if (state.invoiceId !== undefined) {
      setOpenId(state.invoiceId);
      /* The document must be in the list it is opened in. */
      if (askedFilter === null) { setFilter('all'); setSearch(''); setPatientFilter(null); }
    }
    if (wantsNewInvoice(state)) { setUnfinished(state); setFlow({ nav: state }); }
  }, [loading, location.key, location.state, location.pathname, navigate]);

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
      await download(
        { kind: 'invoice-pdf', fileName: pdfFileName(inv.invoiceNumber), open: true, failureMessage: 'PDF se nepodařilo načíst' },
        { kind: 'fetch', fetch: () => billingApi.getInvoicePdf(inv.id) },
      );
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

  /* "Vyžaduje pozornost": the same pure rules as the home's shelf. "Show them all" opens the filter here, not this page again. */
  const attention = useMemo(() => {
    const groups: AttentionGroup[] = [];
    const overdue = overdueInvoices({ now, invoices });
    if (overdue !== null) groups.push({ ...overdue, action: { label: 'Zobrazit po splatnosti', to: '/billing', state: { filter: 'overdue' } } });
    const approvals = canApprove ? invoiceApprovals({ now, invoices }) : null;
    if (approvals !== null) groups.push(approvals);
    return groups.map((g) => ({ ...g, items: [] }));
  }, [invoices, now, canApprove]);

  const primaryAction = { label: 'Nový doklad', icon: <Add />, onClick: () => setFlow({ nav: unfinished }) };
  const emptyText = invoices.length === 0 ? 'Zatím žádné doklady.' : 'Žádný doklad neodpovídá hledání.';
  const ready = !loading && !loadFailed;
  const shown = `Zobrazeno ${filteredInvoices.length} z ${doklady(invoices.length)}`;

  /* On a phone the chips run in one row that scrolls sideways, so they never push the list off the screen. */
  const filters = (
    <Box
      data-filters={phone ? 'scroll' : 'wrap'}
      sx={
        phone
          ? {
              order: 3, flexBasis: '100%', overflowX: 'auto', mx: -2, px: 2, pb: 0.5,
              '& [role="group"]': { flexWrap: 'nowrap', width: 'max-content' },
              '& .MuiButtonBase-root': { minHeight: 44, flexShrink: 0 },
            }
          : undefined
      }
    >
      <FilterChips options={visibleFilters} value={filter} onChange={setFilter} ariaLabel="Filtr dokladů" />
    </Box>
  );

  const showAttention = ready && attention.length > 0;
  /* From 1280 the figures and the attention cards stand side by side. */
  const besideAttention = device === 'desktop' && showAttention;
  const metricsShelf = (
    <Shelf
      id="metrics"
      title="Přehled tržeb"
      hint={monthYear(now)}
      layout={phone ? 'row' : 'grid'}
      minCardWidth={besideAttention ? 160 : 180}
      phoneWidth="min(56vw, 210px)"
      cardHeight={104}
      skeletons={canApprove ? 5 : 4}
      loading={loading}
      stagger={false}
    >
      <MetricCard
        label={`Vyfakturováno ${monthIn(now)}`}
        value={stats.invoicedThisMonth}
        format={czk}
        hint={doklady(stats.invoicedThisMonthCount)}
      />
      <MetricCard
        label="Nezaplaceno"
        value={stats.unpaid}
        format={czk}
        tone={stats.unpaid > 0 ? 'red' : 'grey'}
        hint={`${doklady(stats.overdueCount)} po splatnosti`}
      />
      <MetricCard label="Hotově na místě" value={stats.cashThisMonth} format={czk} hint={`kartou ${czk(stats.cardThisMonth)}`} />
      <MetricCard
        label="Průměr na pacienta"
        value={stats.averagePerPatient === null ? '—' : stats.averagePerPatient}
        format={czk}
        hint={monthYear(now)}
      />
      {canApprove && (
        <MetricCard
          label="Ke schválení"
          value={stats.pendingApprovalCount}
          tone={stats.pendingApprovalCount > 0 ? 'primary' : 'grey'}
          hint="nad limitem ruční slevy"
        />
      )}
    </Shelf>
  );
  const attentionShelf = (
    <Shelf
      id="attention"
      title="Vyžaduje pozornost"
      count={attention.reduce((sum, g) => sum + g.count, 0)}
      countTone="red"
      layout={besideAttention ? 'grid' : 'row'}
      minCardWidth={besideAttention ? 280 : 340}
      fill
      stagger={false}
    >
      {attention.map((g) => <AttentionCard key={g.id} group={g} />)}
    </Shelf>
  );

  return (
    <PageFrame fit title="Fakturace" purpose="Doklady, platby a přehled tržeb" primaryAction={primaryAction}>
      {/*
        * ── The month's figures (a row that swipes on a phone, a grid from a tablet up) and what needs a person (only when
        * there is something). On a desktop they share one band, so the invoice table keeps the height of the window.
        */}
      {besideAttention ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', gap: 3, alignItems: 'start' }}>
          {metricsShelf}
          {attentionShelf}
        </Box>
      ) : (
        <>
          {!loadFailed && metricsShelf}
          {showAttention && attentionShelf}
        </>
      )}

      {/* ── The invoices: search, filters, the table (cards on a phone) ── */}
      <Shelf
        id="invoices"
        title="Doklady"
        count={ready ? filteredInvoices.length : undefined}
        layout="free"
        grow
        loading={loading}
        error={loadFailed ? 'Doklady se nepodařilo načíst.' : false}
        onRetry={load}
        controls={ready ? filters : undefined}
      >
        {patientFilter !== null && (
          <Box sx={{ mb: 1.5, flexShrink: 0 }}>
            <Chip
              color="primary"
              variant="outlined"
              label={`Pacient: ${patientFilterName || 'vybraný pacient'}`}
              onDelete={() => setPatientFilter(null)}
              deleteIcon={<Close aria-label="Zrušit filtr pacienta" />}
              sx={{ minHeight: 44, borderRadius: 22 }}
            />
          </Box>
        )}
        <TextField
          fullWidth
          placeholder="Číslo dokladu, pacient nebo klub"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              sx: { minHeight: 44 },
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
            },
            htmlInput: { 'aria-label': 'Hledat doklad' },
          }}
          sx={{ mb: 1.5, flexShrink: 0 }}
        />
        {phone ? (
          <>
            <InvoiceCards
              invoices={filteredInvoices}
              now={now}
              openId={openId}
              onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
              handlers={handlers}
              empty={emptyText}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>{shown}</Typography>
          </>
        ) : (
          <Paper variant="outlined" sx={{ overflow: 'hidden', ...FIT_FILL_SX, display: 'flex', flexDirection: 'column' }}>
            <Box sx={[{ overflow: 'auto', overscrollBehavior: 'contain', ...FIT_FILL_SX }, STICKY_HEAD_SX]}>
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
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{shown}</Typography>
            </Box>
          </Paper>
        )}
      </Shelf>

      {/* ── New document ── */}
      <NewInvoiceFlow
        open={flow !== null}
        nav={flow?.nav ?? null}
        onClose={() => setFlow(null)}
        onCreated={() => { setUnfinished(null); void reload().catch(() => toast.error('Seznam dokladů se nepodařilo obnovit')); }}
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
    </PageFrame>
  );
}
