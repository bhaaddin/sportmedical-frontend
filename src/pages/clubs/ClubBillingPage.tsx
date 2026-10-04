/*
 * Kluby > Fakturace (Etapa 4): the invoices made out to clubs (recipient type Tým), totals per club, and the
 * confirmed orders paid "Faktura klubu" that still wait for their invoice ("Vystavit fakturu" opens /billing prefilled).
 */
import { useMemo, useState } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { billingApi, type Invoice } from '../../api/billing';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { ResponsiveDataList, type DataColumn } from '../../components/ui/ResponsiveDataList';
import { seatsWithTotal } from '../../components/clubs/orders/orderLogic';
import { formatCzk, formatLongDate } from './clubOrders';
import { customerOf, statusOf } from '../billing/invoiceView';
import { pragueDateKey } from '../../utils/time';
import { LoadError } from './subpages/common';
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

  const openInvoice = (inv: Invoice) => navigate('/billing', { state: { invoiceId: inv.id } });
  /* Etapa 5: the club order -> invoice path is the server's one-invoice-per-group endpoint, not a prefilled form. */
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const issue = (o: ClubOrderView) => setInvoiceFor(o.id);

  const invoiceColumns: DataColumn<Invoice>[] = [
    { key: 'number', header: 'Číslo', tablet: true, cell: (i) => <Typography sx={{ fontWeight: 600 }}>{i.invoiceNumber || '—'}</Typography> },
    { key: 'club', header: 'Klub', tablet: true, cell: (i) => customerOf(i) },
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
          <Typography sx={{ fontWeight: 700 }}>{customerOf(i)}</Typography>
          <StatusChip tone={s.tone}>{s.label}</StatusChip>
        </Stack>
        <Typography variant="body2">{i.invoiceNumber} · {formatCzk(i.totalCzk)}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zbývá {formatCzk(i.remainingCzk)}</Typography>
      </Stack>
    );
  };

  const totalColumns: DataColumn<ClubTotals>[] = [
    { key: 'club', header: 'Klub', tablet: true, cell: (t) => <Typography sx={{ fontWeight: 600 }}>{t.clubName}</Typography> },
    { key: 'issued', header: 'Vystaveno', tablet: true, align: 'right', cell: (t) => formatCzk(t.issuedCzk) },
    { key: 'paid', header: 'Zaplaceno', tablet: true, align: 'right', cell: (t) => formatCzk(t.paidCzk) },
    { key: 'unpaid', header: 'Nezaplaceno', align: 'right', cell: (t) => formatCzk(t.unpaidCzk) },
  ];

  const waitingCard = (o: ClubOrderView) => (
    <SoftCard key={o.id} sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{o.clubName}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {o.serviceName} · {o.activitySeats.length > 0 ? seatsWithTotal(o) : `${o.totalSeats} hráčů`}{o.priceQuote ? ` · ${formatCzk(o.priceQuote.totalCzk)}` : ''}
          </Typography>
        </Box>
        <Button variant="contained" sx={{ minHeight: 44 }} onClick={() => issue(o)}>Vystavit fakturu</Button>
      </Stack>
    </SoftCard>
  );

  return (
    <Box>
      <PageHeader title="Fakturace klubů" subtitle={`Faktury týmům · ${invoices.length}`} />

      {invoicesQuery.isPending ? (
        <Skeleton variant="rounded" height={200} />
      ) : invoicesQuery.isError ? (
        <LoadError onRetry={() => void invoicesQuery.refetch()} />
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 1.5, mb: 3, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}>
            <KpiCard label="Vystaveno" value={formatCzk(sum.issued)} />
            <KpiCard label="Zaplaceno" value={formatCzk(sum.paid)} tone="green" />
            <KpiCard label="Nezaplaceno" value={formatCzk(sum.unpaid)} tone={sum.unpaid > 0 ? 'red' : 'ink'} />
          </Box>

          {awaiting.length > 0 && (
            <Box sx={{ mb: 3 }} data-testid="awaiting-invoice">
              <SectionLabel component="h2" sx={{ mb: 1.5 }}>Čeká na fakturu</SectionLabel>
              <Stack spacing={1}>{awaiting.map(waitingCard)}</Stack>
            </Box>
          )}

          <SectionLabel component="h2" sx={{ mb: 1.5 }}>Podle klubu</SectionLabel>
          <Box sx={{ mb: 3 }}>
            <ResponsiveDataList
              rows={totals}
              rowKey={(t) => t.key}
              columns={totalColumns}
              ariaLabel="Součty podle klubu"
              empty="Žádný klub zatím nemá fakturu."
              renderCard={(t) => (
                <Stack spacing={0.25}>
                  <Typography sx={{ fontWeight: 700 }}>{t.clubName}</Typography>
                  <Typography variant="body2">Vystaveno {formatCzk(t.issuedCzk)} · Zaplaceno {formatCzk(t.paidCzk)}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nezaplaceno {formatCzk(t.unpaidCzk)}</Typography>
                </Stack>
              )}
            />
          </Box>

          <SectionLabel component="h2" sx={{ mb: 1.5 }}>Faktury</SectionLabel>
          <ResponsiveDataList
            rows={invoices}
            rowKey={(i) => i.id}
            columns={invoiceColumns}
            renderCard={invoiceCard}
            onRowClick={openInvoice}
            ariaLabel="Faktury klubů"
            empty="Zatím žádné faktury klubům."
          />
        </>
      )}
      {invoiceFor !== null ? (
        <ClubInvoiceDialog
          orderId={invoiceFor}
          onClose={() => setInvoiceFor(null)}
          onChanged={() => { void ordersQuery.refetch(); void invoicesQuery.refetch(); }}
        />
      ) : null}
    </Box>
  );
}
