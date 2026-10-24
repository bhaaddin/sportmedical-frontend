/*
 * A club's own PAGE - `/clubs/:clubId` (Stage 5a, R7). Přehled -> Kluby a týmy -> a club: first this page, a clear picture
 * of the club in a few shelves; the calendar (the planner with all the orders) is one click further, on "Kalendář".
 *
 *   header         the club (initials on its colour, name, who to call, status), "Upravit údaje" (a pop-out), "Nová objednávka"
 *                  and the ONE prominent button, "Kalendář"
 *   Statistiky     six figures, each a link to where it is worked on: players, terms, orders, ordered / invoiced / paid money
 *   Objednávky     the club's orders as cards (status, code, terms, players, price); a card opens the order, "Historie" its history
 *   Nejbližší termíny, Poslední změny, Hráči, Odkazy
 *
 * Data (all shared query keys, so the club list's warm-up and every order change reach this page): `['clubs','one',id]`,
 * `['club-orders',id,'','']`, `['club-blocks','list']`, `['club-summary',id]`, and - for a person who may bill - the club's
 * invoices. A source that cannot be read is said (a dash and the reason), never drawn as zero. The model is
 * `clubOverviewModel.ts`; nothing here is a number of its own.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, ButtonBase, LinearProgress, Skeleton, Typography } from '@mui/material';
import { CalendarMonth, Edit, Add } from '@mui/icons-material';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../../api/billing';
import { clubBlocksApi } from '../../../api/clubBlocks';
import { clubOrdersApi } from '../../../api/clubOrders';
import { clubsApi } from '../../../api/clubs';
import { usePermission } from '../../../auth/usePermission';
import { ClubAvatar } from '../../../components/clubs/ClubAvatar';
import { formatCzk } from '../../../components/clubs/order/orderFormat';
import { useClubSummary } from '../../../components/clubs/orders/ClubSummaryCard';
import { LinkCopyRow } from '../../../components/clubs/orders/LinkCopyRow';
import { onlyCancelled, withoutCancelled } from '../../../components/clubs/orders/orderLogic';
import { clubCalendarPath, clubOrdersHistoryPath } from '../../../components/shell/plannerRoutes';
import { StatusChip } from '../../../components/ui';
import { useDevice } from '../../../layout/useDevice';
import { pragueDateKey } from '../../../utils/time';
import { EntityCard, MetricCard, PageFrame, PinButton, Shelf, TARGET_SX, MUTED_SX, rememberOpened } from '../../../ui/shelf';
import { canBeInvoiced } from '../payerForm';
import {
  clubMetrics, contactLine, focusOrder, historyPath, newestOrderIds, nextTerms, orderCards, recentChanges, type InvoiceSource, type Source,
} from './clubOverviewModel';

const PayerDialog = lazy(() => import('../PayerDialog').then((m) => ({ default: m.PayerDialog })));
const ClubOrderEntry = lazy(() => import('../../../components/clubs/order/ClubOrderEntry').then((m) => ({ default: m.ClubOrderEntry })));

const isNotFound = (error: unknown): boolean => {
  const e = error as { status?: number; response?: { status?: number } } | null;
  return (e?.status ?? e?.response?.status) === 404;
};

export const OVERVIEW_PAGE_TEXT = {
  calendar: 'Kalendář',
  newOrder: 'Nová objednávka',
  edit: 'Upravit údaje',
  billingMissing: 'Chybí fakturační údaje',
  notFound: 'Tento klub neexistuje.',
  failed: 'Klub se nepodařilo načíst.',
  retry: 'Zkusit znovu',
  back: 'Zpět na kluby',
} as const;

export default function ClubOverviewPage() {
  const { clubId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const device = useDevice();
  const mayBill = usePermission('billing.manage');
  const today = useMemo(() => pragueDateKey(new Date()), []);

  const clubQuery = useQuery({ queryKey: ['clubs', 'one', clubId], queryFn: () => clubsApi.getById(clubId), retry: false });
  const ordersQuery = useQuery({
    queryKey: ['club-orders', clubId, '', ''],
    queryFn: () => clubOrdersApi.list({ clubId }),
    retry: false,
  });
  const blocksQuery = useQuery({ queryKey: ['club-blocks', 'list'], queryFn: () => clubBlocksApi.list(), retry: false });
  const summaryQuery = useClubSummary(clubId);
  const invoicesQuery = useQuery({
    queryKey: ['club-billing', 'club', clubId],
    queryFn: () => billingApi.getInvoices({ clubId }),
    enabled: mayBill && clubId !== '',
    staleTime: 60_000,
    retry: false,
  });

  /* The list answers carry no history; an order's own answer does. Read the few orders touched last (the key the order panel and the history page share). */
  const recentIds = useMemo(() => newestOrderIds(withoutCancelled(ordersQuery.data ?? [])), [ordersQuery.data]);
  const detailQueries = useQueries({
    queries: recentIds.map((id) => ({ queryKey: ['club-order', id], queryFn: () => clubOrdersApi.get(id), staleTime: 60_000, retry: false })),
  });

  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState(false);

  const club = clubQuery.data ?? null;
  useEffect(() => {
    if (club !== null) rememberOpened({ kind: 'club', id: club.id, label: club.name });
  }, [club]);

  /* Warm the calendar when the pointer rests on / reaches the button: its code and the stage's reads (once per visit). */
  const warmed = useRef(false);
  const warmCalendar = () => {
    if (warmed.current) return;
    warmed.current = true;
    void import('../../../api/warmReads').then((reads) => reads.prefetchClubScreen(queryClient, clubId)).catch(() => undefined);
  };

  if (clubQuery.isLoading || (clubQuery.data === undefined && !clubQuery.isError)) {
    return (
      <PageFrame title="Klub" search={false}>
        <Box data-testid="club-page-loading" role="status" aria-busy="true" aria-label="Načítám klub">
          <Skeleton variant="rounded" height={112} sx={{ mb: 3 }} />
          <Skeleton variant="rounded" height={160} />
        </Box>
      </PageFrame>
    );
  }
  if (club === null) {
    const missing = isNotFound(clubQuery.error);
    return (
      <PageFrame title="Klub" search={false}>
        <Box data-testid="club-page-error" sx={{ maxWidth: 560 }}>
          <Alert severity={missing ? 'warning' : 'error'} action={missing ? undefined : <Button color="inherit" size="small" onClick={() => void clubQuery.refetch()} sx={TARGET_SX}>{OVERVIEW_PAGE_TEXT.retry}</Button>}>
            {missing ? OVERVIEW_PAGE_TEXT.notFound : OVERVIEW_PAGE_TEXT.failed}
          </Alert>
          <Button component={RouterLink} to="/clubs" sx={{ mt: 2, ...TARGET_SX }}>{OVERVIEW_PAGE_TEXT.back}</Button>
        </Box>
      </PageFrame>
    );
  }

  const ordersLoading = ordersQuery.isLoading;
  const orders: Source<NonNullable<typeof ordersQuery.data>> = ordersQuery.data ?? 'failed';
  const blocks: Source<NonNullable<typeof blocksQuery.data>> = blocksQuery.data !== undefined ? blocksQuery.data.filter((b) => b.clubId === clubId) : 'failed';
  const summary: Source<NonNullable<typeof summaryQuery.data>> = summaryQuery.data ?? 'failed';
  const invoices: InvoiceSource = !mayBill ? 'denied' : invoicesQuery.data !== undefined ? invoicesQuery.data : invoicesQuery.isLoading ? 'loading' : 'failed';
  /* the invoices are read behind the rest: their two cards say "Načítám…" instead of holding the shelf back */
  const coreLoading = ordersLoading || blocksQuery.isLoading || summaryQuery.isLoading;
  const allCoreFailed = orders === 'failed' && blocks === 'failed' && summary === 'failed';
  const retryCore = () => {
    void ordersQuery.refetch();
    void blocksQuery.refetch();
    void summaryQuery.refetch();
    if (mayBill) void invoicesQuery.refetch();
  };

  /* R21: the page lists and counts LIVE orders; the cancelled ones are behind "Historie" (their count is on the link). */
  const orderList = orders === 'failed' ? [] : withoutCancelled(orders);
  const cancelledCount = orders === 'failed' ? 0 : onlyCancelled(orders).length;
  const metrics = clubMetrics({ clubId, today, orders: orders === 'failed' ? orders : orderList, blocks, summary, invoices });
  const cards = orderCards(orderList);
  const terms = nextTerms(blocks === 'failed' ? [] : blocks, orderList, today);
  const detailsLoading = detailQueries.some((q) => q.isLoading);
  const detailsFailed = detailQueries.length > 0 && detailQueries.every((q) => q.isError);
  const someDetailsFailed = !detailsFailed && detailQueries.some((q) => q.isError);
  const changes = recentChanges(detailQueries.flatMap((q) => (q.data !== undefined ? [q.data] : [])));
  const focus = orders === 'failed' ? null : focusOrder(orderList, blocks === 'failed' ? [] : blocks, today);
  const linkOrder = focus !== null && focus.status !== 'Cancelled' ? focus : null;
  const invoiceable = canBeInvoiced(club);
  const ordersTo = `/clubs/objednavky?clubId=${encodeURIComponent(clubId)}`;
  const historyTo = clubOrdersHistoryPath(clubId);
  const playersTo = `/clubs/hraci?clubId=${encodeURIComponent(clubId)}`;
  const wide = device === 'desktop';

  const status = (
    <>
      <StatusChip tone={club.isActive ? 'green' : 'grey'} testId="club-status">{club.isActive ? 'Aktivní' : 'Neaktivní'}</StatusChip>
      {!invoiceable ? (
        <ButtonBase
          onClick={() => setEditing(true)}
          data-testid="club-billing-warning"
          aria-label={`${OVERVIEW_PAGE_TEXT.billingMissing} - doplnit`}
          sx={{ borderRadius: 999, ...TARGET_SX, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
        >
          <StatusChip tone="red">{OVERVIEW_PAGE_TEXT.billingMissing}</StatusChip>
        </ButtonBase>
      ) : null}
    </>
  );

  return (
    <PageFrame
      title={club.name}
      purpose={contactLine(club)}
      leading={<ClubAvatar name={club.name} color={club.colorHex ?? null} size={48} />}
      titleAddon={<PinButton entity={{ kind: 'club', id: club.id, label: club.name }} />}
      badges={status}
      primaryAction={{ label: OVERVIEW_PAGE_TEXT.calendar, to: clubCalendarPath(club.id), icon: <CalendarMonth />, onIntent: warmCalendar }}
      actions={
        <>
          <Button variant="outlined" startIcon={<Add />} onClick={() => setEntry(true)} data-testid="club-new-order" sx={TARGET_SX}>{OVERVIEW_PAGE_TEXT.newOrder}</Button>
          <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditing(true)} data-testid="club-edit" sx={TARGET_SX}>{OVERVIEW_PAGE_TEXT.edit}</Button>
        </>
      }
    >
      <Shelf
        id="club-stats"
        title="Statistiky"
        hint="Co klub objednal, kolik hráčů je zapsaných a jak je to s penězi"
        layout="row"
        fill
        loading={coreLoading}
        error={allCoreFailed ? 'Statistiky klubu se nepodařilo načíst.' : false}
        onRetry={retryCore}
        skeletons={6}
        minCardWidth={176}
        cardHeight={118}
      >
        {metrics.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            value={m.value}
            hint={m.hint}
            to={m.to}
            format={m.money ? formatCzk : undefined}
            tone={m.tone}
          />
        ))}
      </Shelf>

      <Shelf
        id="club-orders"
        title="Objednávky"
        count={orders === 'failed' ? undefined : cards.length}
        layout="row"
        loading={ordersLoading}
        error={orders === 'failed' ? 'Objednávky klubu se nepodařilo načíst.' : false}
        onRetry={() => void ordersQuery.refetch()}
        empty={cards.length === 0}
        emptyState={{ text: cancelledCount > 0 ? 'Klub nemá žádnou živou objednávku. Zrušené jsou v Historii.' : 'Klub zatím nemá žádnou objednávku.', action: { label: OVERVIEW_PAGE_TEXT.newOrder, onClick: () => setEntry(true) } }}
        viewAll={{ to: ordersTo, label: 'Všechny objednávky' }}
        controls={<Button component={RouterLink} to={historyTo} size="small" variant="outlined" data-testid="club-orders-history-link" aria-label={`Historie zrušených objednávek (${cancelledCount})`} sx={TARGET_SX}>{`Historie (${cancelledCount})`}</Button>}
        minCardWidth={288}
        cardHeight={132}
      >
        {cards.map((c) => (
          <EntityCard
            key={c.id}
            entity={{ kind: 'order', id: c.id, label: c.code }}
            subtitle={c.subtitle}
            detail={[c.detail, c.chip].filter((p) => p !== '').join(' · ')}
            status={{ label: c.statusLabel, tone: c.tone }}
            label={`Objednávka ${c.code}: ${c.statusLabel}`}
            trailing={
              <Button size="small" variant="text" onClick={() => navigate(historyPath(c.id))} aria-label={`Historie objednávky ${c.code}`} data-testid="order-history" sx={TARGET_SX}>Historie</Button>
            }
          />
        ))}
      </Shelf>

      <Box data-shelf-pair="" sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: wide ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', alignItems: 'start' }}>
        <Shelf
          id="club-next-terms"
          title="Nejbližší termíny"
          count={blocks === 'failed' ? undefined : terms.length}
          layout="list"
          maxHeight="min(40dvh, 360px)"
          loading={blocksQuery.isLoading}
          error={blocks === 'failed' ? 'Termíny klubu se nepodařilo načíst.' : false}
          onRetry={() => void blocksQuery.refetch()}
          empty={terms.length === 0}
          emptyState={{ text: 'Klub nemá žádný nadcházející termín.', action: { label: OVERVIEW_PAGE_TEXT.calendar, to: clubCalendarPath(club.id), onIntent: warmCalendar } }}
        >
          {terms.map((t) => (
            <Box key={t.id} role="listitem" data-testid="club-next-term" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'baseline', px: 1.5, py: 1.25 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 650, overflowWrap: 'anywhere' }}>{t.title}</Typography>
                <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>{t.when}</Typography>
              </Box>
              <Typography sx={{ ...MUTED_SX, fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} aria-label={`Hráči ${t.players}`}>{t.players}</Typography>
            </Box>
          ))}
        </Shelf>

        <Shelf
          id="club-changes"
          title="Poslední změny"
          hint={someDetailsFailed ? 'Část historie se nepodařilo načíst.' : orderList.length > 0 ? `Z ${Math.min(orderList.length, recentIds.length)} naposledy změněných objednávek` : undefined}
          count={orders === 'failed' || detailsFailed ? undefined : changes.length}
          layout="list"
          maxHeight="min(40dvh, 360px)"
          loading={ordersLoading || detailsLoading}
          error={orders === 'failed' ? 'Historii klubu se nepodařilo načíst.' : detailsFailed ? 'Historii objednávek se nepodařilo načíst.' : false}
          onRetry={() => { void ordersQuery.refetch(); detailQueries.forEach((q) => void q.refetch()); }}
          empty={changes.length === 0}
          emptyState={{ text: 'Zatím se nic nezměnilo.' }}
          viewAll={focus !== null ? { to: historyPath(focus.id), label: 'Celá historie' } : undefined}
        >
          {changes.map((c) => (
            <Box key={c.key} role="listitem" data-testid="club-change" sx={{ px: 1.5, py: 1.25 }}>
              <Typography sx={{ ...MUTED_SX, fontSize: 12.5 }}>{[c.atText, c.user, c.code].filter((p) => p !== '').join(' · ')}</Typography>
              <Typography sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{c.text}</Typography>
            </Box>
          ))}
        </Shelf>
      </Box>

      <Box data-shelf-pair="" sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: wide ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', alignItems: 'start' }}>
        <Shelf
          id="club-players"
          title="Hráči"
          count={summary === 'failed' ? undefined : summary.registered}
          layout="board"
          loading={summaryQuery.isLoading}
          error={summary === 'failed' ? 'Hráče klubu se nepodařilo načíst.' : false}
          onRetry={() => void summaryQuery.refetch()}
          viewAll={{ to: playersTo, label: 'Zobrazit hráče' }}
        >
          {summary !== 'failed' ? (
            <Box data-testid="club-players-body" sx={{ p: 1.75 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 650 }}>
                {summary.totalSeats === 0 ? 'Klub zatím nemá žádná místa.' : `${summary.registered} z ${summary.totalSeats} míst je obsazeno`}
              </Typography>
              {summary.totalSeats > 0 ? (
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (summary.registered / summary.totalSeats) * 100)}
                  aria-label="Obsazenost míst"
                  sx={{ height: 6, borderRadius: 3, mt: 1.25 }}
                />
              ) : null}
              <Typography sx={{ ...MUTED_SX, fontSize: 13, mt: 1 }}>
                {summary.totalSeats > 0 && summary.remaining > 0 ? `Ještě se může zapsat ${summary.remaining}.` : summary.totalSeats > 0 ? 'Všechna místa jsou obsazena.' : 'Místa vznikají objednávkou.'}
              </Typography>
            </Box>
          ) : null}
        </Shelf>

        <Shelf
          id="club-links"
          title="Odkazy"
          hint={linkOrder !== null ? `Objednávka ${orderCards([linkOrder])[0]?.code ?? ''}` : undefined}
          layout="board"
          loading={ordersLoading}
          error={orders === 'failed' ? 'Odkazy klubu se nepodařilo načíst.' : false}
          onRetry={() => void ordersQuery.refetch()}
          empty={linkOrder === null}
          emptyState={{ text: 'Odkazy vzniknou s první objednávkou klubu.', action: { label: OVERVIEW_PAGE_TEXT.newOrder, onClick: () => setEntry(true) } }}
        >
          {linkOrder !== null ? (
            <Box data-testid="club-links-body" sx={{ p: 1.75, display: 'grid', gap: 1.5 }}>
              {linkOrder.linksStale === true ? (
                <Alert severity="warning" data-testid="links-stale">Odkazy této objednávky nelze zobrazit. Vygenerujte nové v detailu objednávky.</Alert>
              ) : (
                <>
                  <LinkCopyRow
                    label={linkOrder.status === 'Invited' ? 'Odkaz pro klub (formulář objednávky)' : 'Odkaz pro klub (portál klubu)'}
                    path={(linkOrder.portalUrl ?? '') !== '' ? (linkOrder.portalUrl as string) : linkOrder.formUrl}
                    testId="club-portal-url"
                  />
                  {linkOrder.registrationUrl !== '' && (linkOrder.status === 'Confirmed' || linkOrder.status === 'Completed') ? (
                    <LinkCopyRow label="Odkaz pro hráče a rodiče (registrace)" path={linkOrder.registrationUrl} testId="players-url" />
                  ) : null}
                </>
              )}
            </Box>
          ) : null}
        </Shelf>
      </Box>

      {editing ? (
        <Suspense fallback={null}>
          <PayerDialog
            editing={club}
            onClose={() => setEditing(false)}
            onSaved={() => { void queryClient.invalidateQueries({ queryKey: ['clubs'] }); }}
          />
        </Suspense>
      ) : null}
      {entry ? (
        <Suspense fallback={null}>
          <ClubOrderEntry
            open
            defaultClubId={club.id}
            onClose={() => setEntry(false)}
            onPhone={() => { setEntry(false); navigate(clubCalendarPath(club.id), { state: { pickOrder: { clubId: club.id } } }); }}
            onInvited={(invited) => { setEntry(false); void queryClient.invalidateQueries({ queryKey: ['club-orders'] }); navigate('/clubs/objednavky', { state: { openOrderId: invited.id } }); }}
          />
        </Suspense>
      ) : null}
    </PageFrame>
  );
}
