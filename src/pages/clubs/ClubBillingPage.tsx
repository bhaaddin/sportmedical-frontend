/*
 * Kluby > Fakturace (Etapa 4): the invoices made out to clubs (recipient type Tým), totals per club, and the
 * confirmed orders paid "Faktura klubu" that still wait for their invoice ("Vystavit fakturu" opens the invoice dialog).
 * Shelf page: three figures, "K vyfakturování", the clubs' totals and the invoices (the table that grows).
 */
import { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { billingApi, type Invoice } from '../../api/billing';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { StatusChip } from '../../components/ui';
import { ResponsiveDataList, type DataColumn } from '../../components/ui/ResponsiveDataList';
import { formatPricedSeats, orderTotalCzk, priceText } from '../../components/clubs/orders/orderMoney';
import { formatPlayersTotal } from '../../components/clubs/panel/seats';
import { EntityLink, MetricCard, PageFrame, Shelf, TARGET_SX, cardSurface } from '../../ui/shelf';
import { formatCzk, formatLongDate } from './clubOrders';
import { customerOf, statusOf } from '../billing/invoiceView';
import { pragueDateKey } from '../../utils/time';
import { ClubInvoiceDialog } from '../../components/clubs/orders/ClubInvoiceDialog';
import { clubTotals, ordersAwaitingInvoice, teamInvoices, type ClubTotals } from './subpages/billing';

export default function ClubBillingPage() {
  const navigate = useNavigate();
  const invoicesQuery = useQuery({ queryKey: ['club-billing', 'invoices'], queryFn: () => billingApi.getInvoices({}) });
  const ordersQuery = useQuery({ queryKey: ['club-billing', 'orders'], queryFn: () => clubOrdersApi.list({ status: 'Confirmed' }) });

  const now = new Date();
  const invoices = useMemo(() => teamInvoices(invoicesQuery.data ?? []), [invoicesQuery.data]);
  const totals = useMemo(() => clubTotals(invoices), [invoices]);
  const awaiting = useMemo(() => ordersAwaitingInvoice(ordersQuery.data ?? [], invoicesQuery.data ?? []), [ordersQuery.data, invoicesQuery.data]);

  const sum = totals.reduce((a, t) => ({ issued: a.issued + t.issuedCzk, paid: a.paid + t.paidCzk, unpaid: a.unpaid + t.unpaidCzk }), { issued: 0, paid: 0, unpaid: 0 });
  const failed = invoicesQuery.isError;
  const loading = invoicesQuery.isPending;
  const retry = () => void invoicesQuery.refetch();

  const openInvoice = (inv: Invoice) => navigate('/billing', { state: { invoiceId: inv.id } });
  /* Etapa 5: the club order -> invoice path is the server's one-invoice-per-group endpoint, not a prefilled form. */
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const issue = (o: ClubOrderView) => setInvoiceFor(o.id);

  /* The club is a connected name (its page, a peek); in a clickable row the click stays its own. */
  const clubLink = (id: string, name: string) =>
    id !== '' ? <EntityLink entity={{ kind: 'club', id, label: name }} onNavigate={(e) => e.stopPropagation()} /> : <span>{name}</span>;
  const invoiceClub = (i: Invoice) => clubLink(i.clubId ?? '', customerOf(i));
  const invoiceNumber = (i: Invoice) =>
    i.invoiceNumber ? <EntityLink entity={{ kind: 'invoice', id: i.id, label: i.invoiceNumber }} onNavigate={(e) => e.stopPropagation()} /> : <span>—</span>;

  const invoiceColumns: DataColumn<Invoice>[] = [
    { key: 'number', header: 'Číslo', tablet: true, cell: invoiceNumber },
    { key: 'club', header: 'Klub', tablet: true, cell: invoiceClub },
    { key: 'status', header: 'Stav', tablet: true, cell: (i) => { const s = statusOf(i, now); return <StatusChip tone={s.tone}>{s.label}</StatusChip>; } },
    { key: 'issued', header: 'Vystaveno', cell: (i) => formatLongDate(pragueDateKey(i.issueDateUtc)) },
    { key: 'total', header: 'Částka', align: 'right', cell: (i) => formatCzk(i.totalCzk) },
    { key: 'remaining', header: 'Zbývá', align: 'right', cell: (i) => formatCzk(i.remainingCzk) },
  ];
  const invoiceCard = (i: Invoice) => {
    const s = statusOf(i, now);
    return (
      <Stack spacing={0.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700 }} component="span">{invoiceClub(i)}</Typography>
          <StatusChip tone={s.tone}>{s.label}</StatusChip>
        </Stack>
        <Typography variant="body2" component="div">{invoiceNumber(i)} · {formatCzk(i.totalCzk)}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zbývá {formatCzk(i.remainingCzk)}</Typography>
      </Stack>
    );
  };

  const totalColumns: DataColumn<ClubTotals>[] = [
    { key: 'club', header: 'Klub', tablet: true, cell: (t) => clubLink(t.clubId, t.clubName) },
    { key: 'issued', header: 'Vystaveno', tablet: true, align: 'right', cell: (t) => formatCzk(t.issuedCzk) },
    { key: 'paid', header: 'Zaplaceno', tablet: true, align: 'right', cell: (t) => formatCzk(t.paidCzk) },
    { key: 'unpaid', header: 'Nezaplaceno', align: 'right', cell: (t) => formatCzk(t.unpaidCzk) },
  ];

  const waitingCard = (o: ClubOrderView) => (
    <Box key={o.id} role="listitem" data-card="awaiting" sx={(t) => ({ ...cardSurface(t, false), p: 1.5 })}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="div" sx={{ fontWeight: 700 }}>
            {o.clubId ? <EntityLink entity={{ kind: 'club', id: o.clubId, label: o.clubName }} /> : o.clubName}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }} data-testid="awaiting-order-line">
            {o.serviceName} · {o.activitySeats.length > 0 ? `${formatPricedSeats(o.activitySeats)} (${formatPlayersTotal(o.activitySeats)})` : `${o.totalSeats} hráčů`} · {priceText(orderTotalCzk(o))}
          </Typography>
        </Box>
        <Button variant="contained" sx={{ ...TARGET_SX, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => issue(o)}>Vystavit fakturu</Button>
      </Stack>
    </Box>
  );

  return (
    <PageFrame fit title="Fakturace klubů" purpose={`Faktury týmům · ${invoices.length}`}>
      <Shelf id="billing-figures" title="Souhrn" layout="row" fill cardHeight={92} skeletons={3} loading={loading} error={failed ? 'Faktury klubů se nepodařilo načíst.' : false} onRetry={retry}>
        <MetricCard label="Vystaveno" value={sum.issued} format={formatCzk} />
        <MetricCard label="Zaplaceno" value={sum.paid} format={formatCzk} tone="green" />
        <MetricCard label="Nezaplaceno" value={sum.unpaid} format={formatCzk} tone={sum.unpaid > 0 ? 'red' : 'grey'} />
      </Shelf>

      {awaiting.length > 0 && !failed && (
        <Shelf id="awaiting-invoice" title="K vyfakturování" hint="Potvrzené objednávky na fakturu klubu" count={awaiting.length} countTone="beige" layout="grid" minCardWidth={320} stagger={false}>
          {awaiting.map(waitingCard)}
        </Shelf>
      )}

      {!failed && (
        <Shelf id="billing-clubs" title="Podle klubu" count={loading ? undefined : totals.length} layout="free" loading={loading}>
          <ResponsiveDataList
            rows={totals}
            rowKey={(t) => t.key}
            columns={totalColumns}
            ariaLabel="Součty podle klubu"
            empty="Žádný klub zatím nemá fakturu."
            renderCard={(t) => (
              <Stack spacing={0.25}>
                <Typography sx={{ fontWeight: 700 }} component="span">{clubLink(t.clubId, t.clubName)}</Typography>
                <Typography variant="body2">Vystaveno {formatCzk(t.issuedCzk)} · Zaplaceno {formatCzk(t.paidCzk)}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nezaplaceno {formatCzk(t.unpaidCzk)}</Typography>
              </Stack>
            )}
          />
        </Shelf>
      )}

      {!failed && (
        <Shelf id="billing-invoices" title="Faktury" count={loading ? undefined : invoices.length} layout="free" grow loading={loading}>
          <ResponsiveDataList
            fill
            rows={invoices}
            rowKey={(i) => i.id}
            columns={invoiceColumns}
            renderCard={invoiceCard}
            onRowClick={openInvoice}
            ariaLabel="Faktury klubů"
            empty="Zatím žádné faktury klubům."
          />
        </Shelf>
      )}

      {invoiceFor !== null ? (
        <ClubInvoiceDialog
          orderId={invoiceFor}
          onClose={() => setInvoiceFor(null)}
          onChanged={() => { void ordersQuery.refetch(); void invoicesQuery.refetch(); }}
        />
      ) : null}
    </PageFrame>
  );
}
