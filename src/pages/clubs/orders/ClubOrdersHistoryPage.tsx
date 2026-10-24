/*
 * Kluby > Objednávky > Historie (R21, stage 7): the special view of the CANCELLED club orders. The normal orders page
 * lists live orders only; the "Historie" button at its top right (and the club page's "Historie" link, pre-filtered with
 * `?clubId=`) leads here. Search by club or code, filter by club and by the day an order was cancelled, "Otevřít" shows
 * the order in its panel - READ-ONLY, a cancelled order offers no edit action, only its history.
 *
 * The cancelled day and the reason are not on the list answers (they carry no history), so they are read from each
 * cancelled order's own answer (the key the order panel and the history page share), at most MAX_DETAILS of them; the
 * rest show a dash. Router state `{ openOrderId }` opens an order (spent once read), like the orders page.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { clubsApi } from '../../../api/clubs';
import { clubOrdersApi, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { orderCode } from '../../../components/clubs/order/orderFormat';
import { cancellationOf, onlyCancelled, STATUS_TONE, termsSummary } from '../../../components/clubs/orders/orderLogic';
import { ClubOrderDetailPanel } from '../../../components/clubs/orders/ClubOrderDetailPanel';
import { hasOrderState, readOrderState } from '../../../components/clubs/orders/orderRouteState';
import { PageHeader, SoftCard, StatusChip } from '../../../components/ui';
import { FIT_FILL_SX, FIT_SCROLL_SX, FitBody, FitPage } from '../../../components/ui/fit';
import { formatPragueDateTime, pragueDateKey } from '../../../utils/time';
import { historyRows, type CancellationInfo } from './ordersHistory';

/** How many cancelled orders have their own answer read for the date and reason. */
const MAX_DETAILS = 60;
const TARGET = { minHeight: 44 } as const;

export default function ClubOrdersHistoryPage() {
  const device = useDevice();
  const phone = device === 'phone';
  const navigate = useNavigate();
  const location = useLocation();
  const handoff = readOrderState(location.state);

  const [search, setSearch] = useState('');
  const [clubId, setClubId] = useState(() => new URLSearchParams(location.search).get('clubId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(handoff.openOrderId ?? null);

  useEffect(() => {
    if (hasOrderState(handoff)) navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => { const l = await clubsApi.getAll(false); return Array.isArray(l) ? l : []; },
  });
  /* The same key as the orders page, so coming from there costs no read. */
  const ordersQuery = useQuery({
    queryKey: ['club-orders', clubId, '', ''],
    queryFn: ({ signal }) => clubOrdersApi.list(clubId !== '' ? { clubId } : {}, { signal }),
    placeholderData: keepPreviousData,
  });

  const everything = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const cancelled = useMemo(() => onlyCancelled(everything), [everything]);
  const detailIds = useMemo(() => cancelled.slice(0, MAX_DETAILS).map((o) => o.id), [cancelled]);
  const detailQueries = useQueries({
    queries: detailIds.map((id) => ({ queryKey: ['club-order', id], queryFn: () => clubOrdersApi.get(id), staleTime: 60_000, retry: false })),
  });
  const stamp = detailQueries.map((q) => q.dataUpdatedAt).join(',');
  const info = useMemo(() => {
    const out = new Map<string, CancellationInfo>();
    detailIds.forEach((id, i) => {
      const entry = cancellationOf(detailQueries[i]?.data?.history);
      if (entry !== null) out.set(id, { atUtc: entry.atUtc !== '' ? entry.atUtc : null, text: entry.text });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailIds, stamp]);

  const rows = useMemo(
    () => historyRows(everything, { search, clubId, from, to }, info, pragueDateKey),
    [everything, search, clubId, from, to, info],
  );
  const openOrder = openId === null ? undefined : everything.find((o) => o.id === openId);
  const filtered = search !== '' || from !== '' || to !== '' || clubId !== '';

  const cancelledAt = (o: ClubOrderView): string => {
    const at = info.get(o.id)?.atUtc ?? null;
    return at === null ? '—' : formatPragueDateTime(at);
  };
  const reasonOf = (o: ClubOrderView): string => info.get(o.id)?.text ?? '—';

  const scrollSx = phone ? {} : { ...FIT_FILL_SX, ...FIT_SCROLL_SX };

  const cards = (
    <Box
      role="list"
      aria-label="Zrušené objednávky"
      data-list="cards"
      sx={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 1.5, gridAutoRows: 'max-content', alignContent: 'start', ...scrollSx }}
    >
      {rows.map((o) => (
        <SoftCard key={o.id} role="listitem" data-testid="history-card" sx={{ p: 2 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{o.clubName}</Typography>
            <StatusChip tone={STATUS_TONE[o.status]} size="sm">{ORDER_STATUS_LABEL[o.status]}</StatusChip>
          </Stack>
          <Typography variant="body2" color="text.secondary">{orderCode(o.id)} · {o.serviceName || 'Služba nevybrána'}</Typography>
          <Typography variant="body2" color="text.secondary">{termsSummary(o)}</Typography>
          <Typography variant="body2" sx={{ mt: 0.75 }}>Zrušeno: {cancelledAt(o)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Důvod: {reasonOf(o)}</Typography>
          <Button size="small" variant="outlined" onClick={() => setOpenId(o.id)} aria-label={`Otevřít objednávku ${orderCode(o.id)}`} data-testid="history-open" sx={{ mt: 1, ...TARGET }}>Otevřít</Button>
        </SoftCard>
      ))}
    </Box>
  );

  const table = (
    <TableContainer data-list="table" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', ...scrollSx }}>
      <Table size="small" stickyHeader aria-label="Zrušené objednávky">
        <TableHead>
          <TableRow>
            <TableCell>Klub</TableCell>
            <TableCell>Objednávka</TableCell>
            <TableCell>Služba</TableCell>
            <TableCell>Termíny</TableCell>
            <TableCell>Zrušeno</TableCell>
            <TableCell>Důvod</TableCell>
            <TableCell align="right">Akce</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id} hover data-testid="history-row" selected={o.id === openId}>
              <TableCell sx={{ fontWeight: 600 }}>{o.clubName}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{orderCode(o.id)}</TableCell>
              <TableCell>{o.serviceName || '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{termsSummary(o)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{cancelledAt(o)}</TableCell>
              <TableCell sx={{ overflowWrap: 'anywhere' }}>{reasonOf(o)}</TableCell>
              <TableCell align="right">
                <Button size="small" variant="outlined" onClick={() => setOpenId(o.id)} aria-label={`Otevřít objednávku ${orderCode(o.id)}`} data-testid="history-open" sx={TARGET}>Otevřít</Button>
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
    <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}</Stack>
  ) : rows.length === 0 ? (
    <SoftCard sx={{ textAlign: 'center', py: 5 }} data-testid="history-empty">
      <Typography sx={{ fontWeight: 600 }}>
        {cancelled.length > 0 && filtered ? 'Tomuto filtru neodpovídá žádná zrušená objednávka.' : 'Žádné zrušené objednávky.'}
      </Typography>
    </SoftCard>
  ) : device === 'desktop' ? table : cards;

  return (
    <FitPage data-testid="club-orders-history" data-layout={device}>
      <PageHeader
        title="Historie objednávek"
        subtitle="Zrušené objednávky klubů — jen ke čtení"
        leading={(
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/clubs/objednavky')} data-testid="history-back-to-orders" sx={{ ...TARGET, whiteSpace: 'nowrap' }}>
            Zpět na objednávky
          </Button>
        )}
        mb={2}
      />

      <Box sx={{ display: 'grid', gap: 1.5, mb: 2, width: '100%', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(220px, 1.4fr) minmax(200px, 1fr) minmax(150px, 180px) minmax(150px, 180px)' } }}>
        <TextField size="small" label="Hledat klub nebo kód" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }} />
        <TextField select size="small" label="Klub" value={clubId} onChange={(e) => setClubId(e.target.value)} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
          <MenuItem value="">Všechny kluby</MenuItem>
          {(clubsQuery.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="Zrušeno od" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="Zrušeno do" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>

      <FitBody>
        <Box sx={{ minWidth: 0, ...(phone ? {} : { ...FIT_FILL_SX, display: 'flex', flexDirection: 'column' }) }}>{list}</Box>
      </FitBody>

      {openId !== null ? <ClubOrderDetailPanel orderId={openId} initialOrder={openOrder} onClose={() => setOpenId(null)} /> : null}
    </FitPage>
  );
}
