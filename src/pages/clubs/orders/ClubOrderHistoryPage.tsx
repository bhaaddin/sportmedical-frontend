/*
 * Kluby > Objednávky > Historie: EVERYTHING that happened to a club order, on a page of its own (R14a).
 *
 * The order's detail keeps only the current status chip; the whole story is here, as ONE timeline for the order's group
 * (the order, its addenda and the order they belong to): status changes (čeká na formulář, potvrzeno, zrušeno), addenda
 * (created, cancelled), players, terms (windows added, removed, moved), messages to the club and invoices, newest first.
 * Each entry says what kind of thing it is, when (Prague time) and who, and leads to the thing it is about (an addendum ->
 * its order, an invoice -> Faktury).
 *
 * Two views of the same list: "Vše" (the full internal history) and "Co vidí klub" (exactly what the club reads in its
 * portal), and filter chips per kind. "Zpět na objednávku" returns to the orders page with that order open again.
 *
 * The merge is computed here from what the API returns (`GET /club-orders/{id}` of every order of the group); the model
 * is `historyTimeline.ts`.
 */
import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { usePermission } from '../../../auth/usePermission';
import { clubOrdersApi, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView, OrderHistoryItem } from '../../../api/clubOrders';
import { CLUB_ORDERS_HISTORY_PATH } from '../../../components/shell/plannerRoutes';
import { orderCode } from '../../../components/clubs/order/orderFormat';
import { STATUS_TONE } from '../../../components/clubs/orders/orderLogic';
import { visibleToClub } from '../../../components/clubs/orders/ClubVisibleHistory';
import { PageHeader, SoftCard, StatusChip } from '../../../components/ui';
import { FitBody, FitPage, FitPanel } from '../../../components/ui/fit';
import { formatPragueDateTime } from '../../../utils/time';
import {
  HISTORY_KINDS,
  HISTORY_KIND_LABEL,
  buildTimeline,
  filterTimeline,
  kindCounts,
  type HistoryKind,
  type TimelineEntry,
} from './historyTimeline';

export type HistoryView = 'all' | 'club';

/** Newest first, entries without a date last; stable for equal times. */
export function newestFirst(history: readonly OrderHistoryItem[]): OrderHistoryItem[] {
  return history
    .map((item, index) => ({ item, index, at: Date.parse(item.atUtc) }))
    .sort((a, b) => {
      const ta = Number.isNaN(a.at) ? -Infinity : a.at;
      const tb = Number.isNaN(b.at) ? -Infinity : b.at;
      return tb !== ta ? tb - ta : a.index - b.index;
    })
    .map((x) => x.item);
}

export function historyEntries(history: readonly OrderHistoryItem[], view: HistoryView): OrderHistoryItem[] {
  return view === 'club' ? visibleToClub(history) : newestFirst(history);
}

export default function ClubOrderHistoryPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const mayBill = usePermission('billing.manage');
  const [view, setView] = useState<HistoryView>('all');
  const [chosen, setChosen] = useState<ReadonlySet<HistoryKind>>(new Set());

  const query = useQuery({
    queryKey: ['club-order', orderId],
    queryFn: () => clubOrdersApi.get(orderId),
    enabled: orderId !== '',
  });
  const order = query.data;

  /* An addendum's history is read together with its root and the other addenda: one group, one story. */
  const parentId = order?.parentOrderId ?? null;
  const rootQuery = useQuery({
    queryKey: ['club-order', parentId ?? ''],
    queryFn: () => clubOrdersApi.get(parentId ?? ''),
    enabled: parentId !== null,
  });
  const root: ClubOrderView | undefined = parentId === null ? order : rootQuery.data;
  const siblingIds = useMemo(
    () => (root === undefined ? [] : root.addenda.map((a) => a.id).filter((id) => id !== orderId && id !== root.id)),
    [root, orderId],
  );
  const siblings = useQueries({
    queries: siblingIds.map((id) => ({ queryKey: ['club-order', id], queryFn: () => clubOrdersApi.get(id) })),
  });

  /* R21: a cancelled order is not in the orders list - back leads to the cancelled-orders view, which opens it. */
  const back = () => navigate(order?.status === 'Cancelled' ? CLUB_ORDERS_HISTORY_PATH : '/clubs/objednavky', { state: { openOrderId: orderId } });

  const failedReads = siblings.filter((s) => s.isError).length + (parentId !== null && rootQuery.isError ? 1 : 0);
  const entries = useMemo(() => {
    if (order === undefined) return [];
    const rootOrder = root ?? order;
    const members = new Map<string, ClubOrderView>();
    if (order.id !== rootOrder.id) members.set(order.id, order);
    for (const s of siblings) if (s.data !== undefined) members.set(s.data.id, s.data);
    return buildTimeline({ root: rootOrder, addenda: [...members.values()] });
  }, [order, root, siblings]);

  const counts = useMemo(() => kindCounts(entries, view), [entries, view]);
  const shown = useMemo(() => filterTimeline(entries, view, chosen), [entries, view, chosen]);
  const clubCount = entries.filter((e) => e.visibleToClub).length;
  const addendaCount = (root ?? order)?.addenda.length ?? 0;
  const grouped = addendaCount > 0 || (order?.parentOrderId ?? null) !== null;

  const toggle = (kind: HistoryKind) =>
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const open = (entry: TimelineEntry) => {
    if (entry.link?.kind === 'order') navigate('/clubs/objednavky', { state: { openOrderId: entry.link.orderId } });
    else if (entry.link?.kind === 'billing') navigate('/billing');
  };

  const subtitle = order === undefined
    ? 'Co se s objednávkou dělo'
    : `${order.clubName} · ${orderCode(order.id)}${addendaCount > 0 || order.parentOrderId !== null ? ' · včetně dodatků' : ''}`;

  return (
    <FitPage>
      <PageHeader
        title="Historie objednávky"
        subtitle={subtitle}
        leading={(
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={back}
            data-testid="history-back"
            sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
          >
            Zpět na objednávku
          </Button>
        )}
        actions={order !== undefined ? <StatusChip tone={STATUS_TONE[order.status]} size="sm">{ORDER_STATUS_LABEL[order.status]}</StatusChip> : undefined}
        mb={2}
      />

      <FitBody>
        {query.isPending ? (
          <Stack spacing={1.5}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} />)}</Stack>
        ) : query.isError || order === undefined ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Zkusit znovu</Button>}>
            Historii se nepodařilo načíst.
          </Alert>
        ) : (
          <SoftCard sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 0' }}>
            <FitPanel
              head={(
                <Stack spacing={1.25} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                      exclusive
                      value={view}
                      onChange={(_, next: HistoryView | null) => { if (next !== null) setView(next); }}
                      aria-label="Rozsah historie"
                      size="small"
                    >
                      <ToggleButton value="all" data-testid="history-view-all" sx={{ minHeight: 44, px: 2 }}>{`Vše (${entries.length})`}</ToggleButton>
                      <ToggleButton value="club" data-testid="history-view-club" sx={{ minHeight: 44, px: 2 }}>{`Co vidí klub (${clubCount})`}</ToggleButton>
                    </ToggleButtonGroup>
                    {view === 'club' ? (
                      <Typography variant="body2" color="text.secondary">Takto změny vidí klub ve svém portálu.</Typography>
                    ) : null}
                  </Stack>

                  <Stack
                    direction="row"
                    role="group"
                    aria-label="Druh změny"
                    data-testid="history-kinds"
                    sx={{ gap: 0.75, flexWrap: { xs: 'nowrap', md: 'wrap' }, overflowX: { xs: 'auto', md: 'visible' }, pb: { xs: 0.5, md: 0 } }}
                  >
                    {HISTORY_KINDS.filter((kind) => counts[kind] > 0 || chosen.has(kind)).map((kind) => {
                      const on = chosen.has(kind);
                      return (
                        <Chip
                          key={kind}
                          clickable
                          color={on ? 'primary' : 'default'}
                          variant={on ? 'filled' : 'outlined'}
                          label={`${HISTORY_KIND_LABEL[kind]} (${counts[kind]})`}
                          aria-pressed={on}
                          onClick={() => toggle(kind)}
                          data-testid={`history-kind-${kind}`}
                          sx={{ height: 44, flex: '0 0 auto', fontSize: 14 }}
                        />
                      );
                    })}
                    {chosen.size > 0 ? (
                      <Button size="small" onClick={() => setChosen(new Set())} data-testid="history-kinds-clear" sx={{ minHeight: 44, flex: '0 0 auto' }}>
                        Zrušit filtr
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              )}
              bodySx={{ p: 2.5 }}
            >
              {failedReads > 0 ? (
                <Alert
                  severity="warning"
                  sx={{ mb: 1.5 }}
                  data-testid="history-partial"
                  action={<Button color="inherit" size="small" onClick={() => { void rootQuery.refetch(); siblings.forEach((s) => void s.refetch()); }}>Zkusit znovu</Button>}
                >
                  Historii {failedReads === 1 ? 'jednoho dodatku' : 'některých dodatků'} se nepodařilo načíst; ostatní záznamy jsou níže.
                </Alert>
              ) : null}

              {shown.length === 0 ? (
                <Typography variant="body2" color="text.secondary" data-testid="history-empty">
                  {entries.length === 0
                    ? (view === 'club' ? 'Klub zatím nevidí žádné změny.' : 'Bez záznamů.')
                    : view === 'club' && clubCount === 0
                      ? 'Klub zatím nevidí žádné změny.'
                      : 'Žádný záznam tohoto druhu.'}
                </Typography>
              ) : (
                <Stack component="ol" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="order-history">
                  {shown.map((h) => (
                    <Box
                      component="li"
                      key={h.key}
                      data-kind={h.kinds[0]}
                      sx={{ borderLeft: '2px solid', borderColor: h.visibleToClub ? 'primary.main' : 'divider', pl: 1.5 }}
                    >
                      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }} data-testid="history-kind">
                          {h.kinds.map((kind) => HISTORY_KIND_LABEL[kind]).join(' · ')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {h.atUtc !== '' ? formatPragueDateTime(h.atUtc) : ''}{view === 'all' && h.user !== '' ? ` · ${h.user}` : ''}
                        </Typography>
                        {grouped ? (
                          <Typography variant="caption" color="text.secondary">
                            {h.isAddendum ? `Dodatek ${h.orderCode}` : `Objednávka ${h.orderCode}`}
                          </Typography>
                        ) : null}
                        {view === 'all' && h.visibleToClub ? (
                          <StatusChip tone="blue" size="sm">Vidí klub</StatusChip>
                        ) : null}
                      </Stack>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{h.text}</Typography>
                      {h.link !== null && (h.link.kind === 'order' || mayBill) ? (
                        <Button size="small" onClick={() => open(h)} data-testid="history-link" sx={{ minHeight: 44, px: 0.5 }}>
                          {h.link.label}
                        </Button>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              )}
            </FitPanel>
          </SoftCard>
        )}
      </FitBody>
    </FitPage>
  );
}
