/*
 * Objednávky klubů (Etapa 4): every club order in one list - table on a desktop, three columns of cards on a
 * tablet, one column on a phone. A row opens the detail (ClubOrderDetailPanel); "Nová objednávka" opens
 * ClubOrderDialog (programmatic prefill only); "Nová objednávka" asks the two-way question: "Vyplním sám" goes
 * to the calendar's fast picking mode, "Poslat odkaz klubu" creates an Invited order and shows its short link.
 *
 * Router state (spent once read): { openOrderId } opens that order; { newOrder: {clubId?, serviceId?,
 * ranges?, calendarIds?} | true } opens the dialog prefilled.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, LinearProgress, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { clubsApi } from '../../../api/clubs';
import { clubOrdersApi, ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { formatCzk } from '../clubOrders';
import { FilterChips, PageHeader, SoftCard, StatusChip } from '../../../components/ui';
import { ClubOrderDialog } from '../../../components/clubs/order/ClubOrderDialog';
import { ClubOrderDetailPanel } from '../../../components/clubs/orders/ClubOrderDetailPanel';
import { ClubOrderEntry } from '../../../components/clubs/order/ClubOrderEntry';
import { PinnedActions } from '../PinnedActions';
import { activitiesLine, filterOrders, groupChip, seatPercent, statusCounts, STATUS_TONE, termsSummary } from '../../../components/clubs/orders/orderLogic';
import type { OrderStatusFilter } from '../../../components/clubs/orders/orderLogic';
import { hasOrderState, readOrderState } from '../../../components/clubs/orders/orderRouteState';
import type { NewOrderPrefill } from '../../../components/clubs/orders/orderRouteState';

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

const priceOf = (o: ClubOrderView): string => (o.priceQuote === null ? '—' : formatCzk(o.priceQuote.totalCzk));
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
  const [dialog, setDialog] = useState<NewOrderPrefill | null>(() =>
    handoff.newOrder === undefined ? null : handoff.newOrder === true ? {} : handoff.newOrder,
  );
  const [entryOpen, setEntryOpen] = useState(false);

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
    queryFn: () => clubOrdersApi.list({ ...(clubId !== '' ? { clubId } : {}), ...(from !== '' ? { from } : {}), ...(to !== '' ? { to } : {}) }),
  });

  const all = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const counts = useMemo(() => statusCounts(all), [all]);
  const visible = useMemo(() => filterOrders(all, status, from, to), [all, status, from, to]);
  const openOrder = openId === null ? undefined : all.find((o) => o.id === openId);

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

  return (
    <Box data-testid="club-orders" data-layout={device} data-columns={columns}>
      <PageHeader title="Objednávky klubů" subtitle="Co kluby objednaly, co čeká na zpracování a co je v kalendáři" actions={phone ? undefined : actions} />

      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
        <FilterChips ariaLabel="Stav objednávky" options={options} value={status} onChange={setStatus} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField select size="small" label="Klub" value={clubId} onChange={(e) => setClubId(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">Všechny kluby</MenuItem>
            {(clubsQuery.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Termín od" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="Termín do" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      </Stack>

      {ordersQuery.isError ? (
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
      ) : columns > 0 ? (
        <Box role="list" aria-label="Objednávky klubů" sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1.5 }}>
          {visible.map((o) => (
            <SoftCard
              key={o.id}
              role="listitem"
              tabIndex={0}
              data-testid="order-card"
              onClick={() => setOpenId(o.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(o.id); } }}
              sx={{ p: 2, cursor: 'pointer', minHeight: 44, '&:hover, &:focus-visible': { borderColor: 'primary.main', outline: 'none' } }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Dot color={o.clubColorHex} />
                <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{o.clubName}</Typography>
                {groupChip(o) !== '' ? <StatusChip tone="blue" size="sm" testId="group-chip">{groupChip(o)}</StatusChip> : null}
                <StatusChip tone={STATUS_TONE[o.status]} size="sm">{ORDER_STATUS_LABEL[o.status]}</StatusChip>
              </Stack>
              <Typography variant="body2" color="text.secondary">{o.serviceName || 'Služba nevybrána'}</Typography>
              <Typography variant="body2">{activitiesLine(o)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{termsSummary(o)}</Typography>
              <SeatsBar order={o} />
              <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75 }}>
                <Typography variant="caption" color="text.secondary">{paymentOf(o)}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{priceOf(o)}</Typography>
              </Stack>
            </SoftCard>
          ))}
        </Box>
      ) : (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table size="small" aria-label="Objednávky klubů">
            <TableHead>
              <TableRow>
                <TableCell>Klub</TableCell>
                <TableCell>Služba</TableCell>
                <TableCell>Činnosti × počty</TableCell>
                <TableCell>Termíny</TableCell>
                <TableCell>Místa</TableCell>
                <TableCell>Platba</TableCell>
                <TableCell align="right">Cena</TableCell>
                <TableCell>Stav</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((o) => (
                <TableRow key={o.id} hover tabIndex={0} data-testid="order-row" onClick={() => setOpenId(o.id)} sx={{ cursor: 'pointer' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(o.id); }}>
                  <TableCell sx={{ fontWeight: 600 }}><Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}><Dot color={o.clubColorHex} />{o.clubName}</Stack></TableCell>
                  <TableCell>{o.serviceName || '—'}</TableCell>
                  <TableCell>{activitiesLine(o)}</TableCell>
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
      )}

      <PinnedActions>{actions}</PinnedActions>

      {openId !== null ? (
        <ClubOrderDetailPanel orderId={openId} initialOrder={openOrder} onClose={() => setOpenId(null)} />
      ) : null}

      <ClubOrderDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        initial={dialog ?? undefined}
        onSaved={(saved) => { setDialog(null); void ordersQuery.refetch(); setOpenId(saved.id); }}
      />
      <ClubOrderEntry
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        onPhone={(startClubId) => navigate('/planovani', { state: { pickOrder: startClubId !== undefined ? { clubId: startClubId } : true } })}
        onInvited={() => void ordersQuery.refetch()}
      />
    </Box>
  );
}
