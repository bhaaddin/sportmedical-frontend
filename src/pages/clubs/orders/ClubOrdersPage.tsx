/*
 * Objednávky klubů (Etapa 4): every club order in one list - table on a desktop, cards on a tablet, one column on a
 * phone. A row opens the detail (ClubOrderDetailPanel); "Nová objednávka" asks the two-way
 * question: "Vyplním sám" goes to the calendar's manual picking mode (small setup form, then the calendar),
 * "Poslat odkaz klubu" creates an Invited order and shows its short link.
 *
 * The page is one screen (the planner rebuild's owner rule: nothing scrolls up and down): from 1024 px the list is a
 * panel of its own (head sticks, rows scroll) and an opened order is a second panel beside it, each scrolling by
 * itself; a narrower window keeps the detail as a drawer, a phone as a full-screen drawer. When the detail is open and
 * the list pane gets narrow, the table gives way to cards so no column is squeezed.
 *
 * Router state (spent once read): { openOrderId } opens that order; { newOrder: {clubId?} | true } opens the chooser.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, LinearProgress, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { clubsApi } from '../../../api/clubs';
import { clubOrdersApi, ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { clubCalendarPath } from '../../../components/shell/plannerRoutes';
import { formatPricedSeats, orderTotalCzk, priceText } from '../../../components/clubs/orders/orderMoney';
import { FilterChips, PageHeader, SoftCard, StatusChip } from '../../../components/ui';
import { FIT_FILL_SX, FIT_SCROLL_SX, FitBody, FitPage } from '../../../components/ui/fit';
import { useElementWidth } from './useElementWidth';
import { ClubOrderDetailPanel } from '../../../components/clubs/orders/ClubOrderDetailPanel';
import { ClubOrderEntry } from '../../../components/clubs/order/ClubOrderEntry';
import { PinnedActions } from '../PinnedActions';
import { filterOrders, groupChip, seatPercent, statusCounts, STATUS_TONE, termsSummary } from '../../../components/clubs/orders/orderLogic';
import type { OrderStatusFilter } from '../../../components/clubs/orders/orderLogic';
import { hasOrderState, readOrderState } from '../../../components/clubs/orders/orderRouteState';

const Dot = ({ color }: { color: string | null }) => (
  <Box aria-hidden data-testid="club-dot" data-color={color ?? ''} sx={{ width: 10, height: 10, borderRadius: '50%', flex: '0 0 10px', bgcolor: color ?? 'divider' }} />
);

function SeatsBar({ order }: { order: ClubOrderView }) {
  return (
    <Box sx={{ minWidth: 110 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.registered} / {order.totalSeats}</Typography>
      <LinearProgress variant="determinate" value={seatPercent(order.registered, order.totalSeats)} aria-label={`Místa: ${order.clubName}`} />
    </Box>
  );
}

/* Etapa 12: every row carries the order's total and every činnost its unit price; "bez ceny" when the server has none. */
const priceOf = (o: ClubOrderView): string => priceText(orderTotalCzk(o));
const activitiesOf = (o: ClubOrderView): string => formatPricedSeats(o.activitySeats.map((a) => ({ ...a, registered: a.registered })));
/** Narrower than this and the table's eight columns would be squeezed: the list becomes cards. */
const TABLE_MIN_WIDTH = 1300;
/** The docked detail: a third of the room, never less than a readable form nor more than a comfortable column. */
const DETAIL_WIDTH = 'clamp(400px, 34%, 620px)';

const paymentOf = (o: ClubOrderView): string => (o.paymentMethod === null ? '—' : PAYMENT_METHOD_LABEL[o.paymentMethod]);

export default function ClubOrdersPage() {
  const device = useDevice();
  const phone = device === 'phone';
  const navigate = useNavigate();
  const location = useLocation();
  const handoff = readOrderState(location.state);

  const [status, setStatus] = useState<OrderStatusFilter>('all');
  /* `?clubId=` (the club page's "Všechny objednávky") pre-filters the list to that club. */
  const [clubId, setClubId] = useState(() => new URLSearchParams(location.search).get('clubId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(handoff.openOrderId ?? null);
  const [entryOpen, setEntryOpen] = useState(handoff.newOrder !== undefined);
  const [entryClubId] = useState<string | undefined>(() => (handoff.newOrder === undefined || handoff.newOrder === true ? undefined : handoff.newOrder.clubId));

  /* Spend the handoff once read, so Back does not reopen it. */
  useEffect(() => {
    if (hasOrderState(handoff)) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => { const l = await clubsApi.getAll(false); return Array.isArray(l) ? l : []; },
  });
  const ordersQuery = useQuery({
    queryKey: ['club-orders', clubId, from, to],
    queryFn: ({ signal }) => clubOrdersApi.list({ ...(clubId !== '' ? { clubId } : {}), ...(from !== '' ? { from } : {}), ...(to !== '' ? { to } : {}) }, { signal }),
    placeholderData: keepPreviousData,
  });

  const all = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const counts = useMemo(() => statusCounts(all), [all]);
  const visible = useMemo(() => filterOrders(all, status, from, to), [all, status, from, to]);
  const openOrder = openId === null ? undefined : all.find((o) => o.id === openId);

  /* From 1024 px the opened order sits beside the list instead of over it. */
  const wide = useMediaQuery('(min-width: 1024px)');
  const docked = !phone && wide;
  const [listRef, listWidth] = useElementWidth();
  /* The list is a table on a desktop; a tablet, a phone and a list squeezed by the docked detail draw cards. */
  const squeezed = docked && openId !== null && listWidth !== null && listWidth < TABLE_MIN_WIDTH;
  const asCards = device !== 'desktop' || squeezed;
  const columns = phone ? 1 : device === 'tablet' ? 3 : 0;

  const options = [
    { key: 'all' as OrderStatusFilter, label: 'Vše', count: counts.all },
    ...ORDER_STATUSES.map((s) => ({ key: s as OrderStatusFilter, label: ORDER_STATUS_LABEL[s], count: counts[s] })),
  ];

  const actions = (
    <>
      <Button variant="contained" onClick={() => setEntryOpen(true)}>Nová objednávka</Button>
    </>
  );

  /* The list's own scroll: tablet and desktop only (a phone's page flows and the region scrolls it). */
  const scrollSx = phone ? {} : { ...FIT_FILL_SX, ...FIT_SCROLL_SX };

  const cards = (
    <Box
      role="list"
      aria-label="Objednávky klubů"
      data-list="cards"
      sx={{
        display: 'grid',
        gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
        gap: 1.5,
        /* rows as tall as their card: in a scroll box of fixed height, `auto` rows would shrink to the cards' min-height */
        gridAutoRows: 'max-content',
        alignContent: 'start',
        ...scrollSx,
      }}
    >
      {visible.map((o) => (
        <SoftCard
          key={o.id}
          role="listitem"
          tabIndex={0}
          data-testid="order-card"
          aria-current={o.id === openId ? 'true' : undefined}
          onClick={() => setOpenId(o.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(o.id); } }}
          sx={{
            p: 2, cursor: 'pointer', minHeight: 44,
            ...(o.id === openId ? { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` } : {}),
            '&:hover, &:focus-visible': { borderColor: 'primary.main', outline: 'none' },
          }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75 }}>
            <Dot color={o.clubColorHex} />
            <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{o.clubName}</Typography>
            {groupChip(o) !== '' ? <StatusChip tone="blue" size="sm" testId="group-chip">{groupChip(o)}</StatusChip> : null}
            <StatusChip tone={STATUS_TONE[o.status]} size="sm">{ORDER_STATUS_LABEL[o.status]}</StatusChip>
          </Stack>
          <Typography variant="body2" color="text.secondary">{o.serviceName || 'Služba nevybrána'}</Typography>
          <Typography variant="body2" data-testid="order-card-activities" sx={{ overflowWrap: 'anywhere' }}>{activitiesOf(o)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{termsSummary(o)}</Typography>
          <SeatsBar order={o} />
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1, mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary">{paymentOf(o)}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{priceOf(o)}</Typography>
          </Stack>
        </SoftCard>
      ))}
    </Box>
  );

  const table = (
    <TableContainer data-list="table" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', ...scrollSx }}>
      <Table size="small" stickyHeader aria-label="Objednávky klubů">
        <TableHead>
          <TableRow>
            <TableCell>Klub</TableCell>
            <TableCell>Služba</TableCell>
            <TableCell>Činnosti × počty · cena za místo</TableCell>
            <TableCell>Termíny</TableCell>
            <TableCell>Místa</TableCell>
            <TableCell>Platba</TableCell>
            <TableCell align="right">Cena</TableCell>
            <TableCell>Stav</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((o) => (
            <TableRow key={o.id} hover selected={o.id === openId} aria-current={o.id === openId ? 'true' : undefined} tabIndex={0} data-testid="order-row" onClick={() => setOpenId(o.id)} sx={{ cursor: 'pointer' }}
              onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(o.id); }}>
              <TableCell sx={{ fontWeight: 600 }}><Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}><Dot color={o.clubColorHex} />{o.clubName}</Stack></TableCell>
              <TableCell>{o.serviceName || '—'}</TableCell>
              <TableCell data-testid="order-row-activities">{activitiesOf(o)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{termsSummary(o)}</TableCell>
              <TableCell><SeatsBar order={o} /></TableCell>
              <TableCell>{paymentOf(o)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{priceOf(o)}</TableCell>
              <TableCell>
                <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusChip tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</StatusChip>
                  {groupChip(o) !== '' ? <StatusChip tone="blue" testId="group-chip">{groupChip(o)}</StatusChip> : null}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const list = ordersQuery.isError ? (
    <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void ordersQuery.refetch()}>Zkusit znovu</Button>}>
      Objednávky se nepodařilo načíst.
    </Alert>
  ) : ordersQuery.isLoading ? (
    <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}</Stack>
  ) : visible.length === 0 ? (
    <SoftCard sx={{ textAlign: 'center', py: 5 }}>
      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{all.length === 0 ? 'Zatím tu žádná objednávka není.' : 'Tomuto filtru neodpovídá žádná objednávka.'}</Typography>
      {all.length === 0 ? <Typography variant="body2" color="text.secondary">Pošlete klubu formulář nebo založte objednávku sami.</Typography> : null}
    </SoftCard>
  ) : asCards ? cards : table;

  return (
    <FitPage data-testid="club-orders" data-layout={device} data-columns={columns} data-docked={docked && openId !== null ? 'true' : 'false'}>
      <PageHeader title="Objednávky klubů" subtitle="Co kluby objednaly, co čeká na zpracování a co je v kalendáři" actions={phone ? undefined : actions} mb={2} />

      {/* The filters share a row with the status chips when the window is wide enough, and wrap under them when it is not. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 3, rowGap: 1.5, mb: 2 }}>
        <FilterChips ariaLabel="Stav objednávky" options={options} value={status} onChange={setStatus} />
        <Box sx={{ display: 'grid', gap: 1.5, width: { xs: '100%', md: 'auto' }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(200px, 260px) minmax(150px, 180px) minmax(150px, 180px)' } }}>
          <TextField select size="small" label="Klub" value={clubId} onChange={(e) => setClubId(e.target.value)} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <MenuItem value="">Všechny kluby</MenuItem>
            {(clubsQuery.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Termín od" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="Termín do" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
      </Box>

      {/* The list and (from 1024 px, when an order is open) its detail: two panels of the one screen, each scrolling itself. */}
      <FitBody sx={docked ? { flexDirection: 'row', gap: 2 } : undefined}>
        <Box ref={listRef} sx={{ minWidth: 0, ...(phone ? {} : { ...FIT_FILL_SX, display: 'flex', flexDirection: 'column' }) }}>
          {list}
        </Box>
        {docked && openId !== null ? (
          <Box sx={{ flex: `0 0 ${DETAIL_WIDTH}`, minWidth: 0, minHeight: 0 }}>
            <ClubOrderDetailPanel key={openId} docked orderId={openId} initialOrder={openOrder} onClose={() => setOpenId(null)} />
          </Box>
        ) : null}
      </FitBody>

      <PinnedActions>{actions}</PinnedActions>

      {!docked && openId !== null ? (
        <ClubOrderDetailPanel orderId={openId} initialOrder={openOrder} onClose={() => setOpenId(null)} />
      ) : null}

      <ClubOrderEntry
        open={entryOpen}
        defaultClubId={entryClubId}
        onClose={() => setEntryOpen(false)}
        onPhone={(startClubId) => navigate(startClubId !== undefined ? clubCalendarPath(startClubId) : '/planovani', { state: { pickOrder: startClubId !== undefined ? { clubId: startClubId } : true } })}
        onInvited={() => void ordersQuery.refetch()}
      />
    </FitPage>
  );
}
