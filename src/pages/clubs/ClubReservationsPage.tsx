/*
 * Kluby > Rezervace (Etapa 4): every club window (block) in one list - club, order, dates, daily window,
 * calendars and činnosti, seats registered, status. Phone = cards, tablet = 3-column table, desktop = full table.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Link, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { clubBlocksApi } from '../../api/clubBlocks';
import { clubOrdersApi } from '../../api/clubOrders';
import { calendarsApi } from '../../api/calendars';
import { PageHeader, SoftCard, StatusChip } from '../../components/ui';
import { ResponsiveDataList, type DataColumn } from '../../components/ui/ResponsiveDataList';
import { pragueDateKey } from '../../utils/time';
import { orderCode } from '../../components/clubs/order/orderFormat';
import { priceText } from '../../components/clubs/orders/orderMoney';
import { formatDateRange } from './clubOrders';
import { ClubDot, LoadError, RangeFilter, SeatsBar, SelectFilter } from './subpages/common';
import { rangeFor, type DateRange, type RangeKey } from './subpages/range';
import { buildReservationRows, dailyWindow, filterReservations, type ReservationRow } from './subpages/reservations';

export default function ClubReservationsPage() {
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<RangeKey>('month');
  const [custom, setCustom] = useState<DateRange>({ from: null, to: null });
  const [clubId, setClubId] = useState('');
  const [status, setStatus] = useState<'' | 'Active' | 'Cancelled'>('');

  const blocksQuery = useQuery({ queryKey: ['club-reservations', 'blocks'], queryFn: () => clubBlocksApi.list({}) });
  /* Orders and calendar names only enrich the rows; the page works without them. */
  const ordersQuery = useQuery({ queryKey: ['club-reservations', 'orders'], queryFn: () => clubOrdersApi.list({}) });
  const calendarsQuery = useQuery({ queryKey: ['club-reservations', 'calendars'], queryFn: () => calendarsApi.list() });

  const today = pragueDateKey(new Date());
  const range = rangeFor(rangeKey, today, custom);

  const all = useMemo(() => {
    const names = new Map((calendarsQuery.data ?? []).map((c) => [c.id, c.name] as const));
    return buildReservationRows(blocksQuery.data ?? [], ordersQuery.data ?? [], names);
  }, [blocksQuery.data, ordersQuery.data, calendarsQuery.data]);

  const clubs = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of all) m.set(r.block.clubId, r.block.clubName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'cs'));
  }, [all]);

  const rows = useMemo(() => filterReservations(all, { clubId, status, range }), [all, clubId, status, range]);

  const openOrder = (orderId: string) => navigate('/clubs/objednavky', { state: { openOrderId: orderId } });
  const showInCalendar = (row: ReservationRow) => navigate('/planovani', { state: { date: row.block.fromDate } });

  const orderLink = (row: ReservationRow) =>
    row.orderId === null ? (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Bez objednávky</Typography>
    ) : (
      <Link component="button" type="button" onClick={(e) => { e.stopPropagation(); openOrder(row.orderId!); }} sx={{ fontWeight: 600 }}>
        {`Objednávka ${orderCode(row.orderId)}`}
      </Link>
    );

  /* Etapa 12: the order's total (what the club pays, after its discount) and, under it, this window's seats at the list price. */
  const money = (row: ReservationRow) =>
    row.orderId === null ? (
      <Typography variant="body2" sx={{ color: 'text.secondary' }} data-testid="reservation-price">bez ceny</Typography>
    ) : (
      <Box data-testid="reservation-price">
        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{`objednávka ${priceText(row.orderTotalCzk)}`}</Typography>
        {row.windowValueCzk !== null ? <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', display: 'block' }}>{`okno ${priceText(row.windowValueCzk)} v ceníku`}</Typography> : null}
      </Box>
    );

  const statusChip = (row: ReservationRow) =>
    row.block.status === 'Cancelled' ? <StatusChip tone="grey">Zrušeno</StatusChip> : <StatusChip tone="green">Aktivní</StatusChip>;

  const calendarButton = (row: ReservationRow) => (
    <Button size="small" variant="outlined" sx={{ minHeight: 36 }} onClick={(e) => { e.stopPropagation(); showInCalendar(row); }}>
      Zobrazit v kalendáři
    </Button>
  );

  const columns: DataColumn<ReservationRow>[] = [
    {
      key: 'club', header: 'Klub', tablet: true,
      cell: (r) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ClubDot color={r.block.colorHex} />
          <Typography sx={{ fontWeight: 600 }}>{r.block.clubName}</Typography>
        </Stack>
      ),
    },
    {
      key: 'term', header: 'Termín', tablet: true,
      cell: (r) => (
        <>
          <Typography>{formatDateRange(r.block.fromDate, r.block.toDate)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{dailyWindow(r.block)}</Typography>
        </>
      ),
    },
    { key: 'seats', header: 'Zapsáno', tablet: true, cell: (r) => <SeatsBar registered={r.registered} seats={r.seats} /> },
    { key: 'order', header: 'Objednávka', cell: orderLink },
    { key: 'what', header: 'Kalendáře a činnosti', cell: (r) => <Typography variant="body2">{[...r.calendars, ...r.activities].join(', ') || '—'}</Typography> },
    { key: 'price', header: 'Cena', align: 'right', cell: money },
    { key: 'status', header: 'Stav', cell: statusChip },
    { key: 'actions', header: '', align: 'right', cell: calendarButton },
  ];

  const card = (r: ReservationRow) => (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <ClubDot color={r.block.colorHex} />
          <Typography sx={{ fontWeight: 700 }} noWrap>{r.block.clubName}</Typography>
        </Stack>
        {statusChip(r)}
      </Stack>
      <Typography variant="body2">{formatDateRange(r.block.fromDate, r.block.toDate)} · {dailyWindow(r.block)}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{[...r.calendars, ...r.activities].join(', ') || '—'}</Typography>
      <SeatsBar registered={r.registered} seats={r.seats} />
      {money(r)}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        {orderLink(r)}
        {calendarButton(r)}
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <PageHeader title="Rezervace klubů" subtitle={`Termíny a okna klubů v kalendáři · ${rows.length}`} />
      <SoftCard sx={{ mb: 2 }}>
        <Stack spacing={1.5}>
          <RangeFilter value={rangeKey} custom={custom} onChange={setRangeKey} onCustom={setCustom} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <SelectFilter
              label="Klub"
              value={clubId}
              onChange={setClubId}
              options={[{ value: '', label: 'Všechny kluby' }, ...clubs.map(([id, name]) => ({ value: id, label: name }))]}
            />
            <SelectFilter
              label="Stav"
              value={status}
              onChange={(v) => setStatus(v as '' | 'Active' | 'Cancelled')}
              options={[{ value: '', label: 'Všechny' }, { value: 'Active', label: 'Aktivní' }, { value: 'Cancelled', label: 'Zrušené' }]}
            />
          </Stack>
        </Stack>
      </SoftCard>

      {blocksQuery.isPending ? (
        <Skeleton variant="rounded" height={160} />
      ) : blocksQuery.isError ? (
        <LoadError onRetry={() => void blocksQuery.refetch()} />
      ) : (
        <ResponsiveDataList
          rows={rows}
          rowKey={(r) => r.block.id}
          columns={columns}
          renderCard={card}
          ariaLabel="Rezervace klubů"
          empty="V tomto období nejsou žádné rezervace klubů."
        />
      )}
    </Box>
  );
}
