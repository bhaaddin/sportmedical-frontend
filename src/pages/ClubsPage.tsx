/*
 * Kluby a týmy - design board 3. 10. 2026, screens 16 and 17, in three layouts
 * (phone: cards in one column and the actions pinned to the bottom; tablet: two
 * columns; desktop: the board's three).
 *
 * This is the LIST of clubs. A card shows a reservation or a block running, who to
 * call, how many athletes it brings and the discount the administrator gave it.
 * Opening a card goes to the club's own PAGE, `/clubs/:clubId` (pages/clubs/overview):
 * the statistics, the orders, the players. Its "Kalendář" button opens the planner in
 * club mode, `/clubs/:clubId/kalendar` (planner/ClubPlannerPage).
 *
 * The data is what the API answers. Payers come from `/api/clubs`, club blocks
 * from `/api/v1/club-blocks` (C4), reservations are the partner orders of every
 * calendar the user may see (4.7), the discount is the one the administrator
 * set on the club's card, and prices come through the activities from the price
 * list. Nothing on this screen is a number of its own: every count is the
 * server's and every sum is worked out in `clubs/clubOrders.ts`.
 *
 * Router state this page understands (all optional, spent once read):
 *
 *   { clubId }                       go to that club's page (`/clubs/:clubId`)
 *   { clubId, clubBlockId }          go to that club's calendar (`/clubs/:clubId/kalendar`) and land on that block
 *   { clubBlockId }                  the same, the club is found from the block
 *   { openOrderId } / { newOrder }   open an order's detail / the new-order chooser
 *
 * Built as shelves (docs/ui-shelf-system.md, S-4): "Čeká na vás" (the inquiries clubs sent, only when there are any - the
 * next step), the clubs this person opened or pinned (only when there are any), and "Kluby" - the search, the chips and the
 * cards, a shelf that takes the height that is left and scrolls inside it.
 *
 * The payer record itself - IČO, fakturační adresa, bankovní spojení - is edited
 * here for a new club ("Nový klub") and from the club's screen ("Upravit údaje"),
 * because an invoice to a club needs all of that and the day it is due is the
 * wrong day to find it missing.
 */
import { useEffect, useMemo, useState } from 'react';
import { invalidateClubWorld } from '../components/clubs/clubWorld';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubsApi } from '../api/clubs';
import type { Club } from '../api/clubs';
import { calendarsApi } from '../api/calendars';
import { clubBlocksApi } from '../api/clubBlocks';
import type { ClubBlockView } from '../api/clubBlocks';
import { clubOrdersApi } from '../api/clubOrders';
import { liveTotalsByClub } from '../components/clubs/orders/orderMoney';
import { partnerOrdersApi } from '../api/partnerOrders';
import { useDevice } from '../layout/useDevice';
import { toDateOnly } from '../utils/time';
import { FilterChips } from '../components/ui';
import { FIT_FILL_SX, FIT_SCROLL_SX } from '../components/ui/fit';
import { AttentionCard, MUTED_SX, PageFrame, RecentAndPinned, Shelf, TARGET_SX, cardSurface } from '../ui/shelf';
import { clubInquiries } from '../ui/shelf/attention';
import { matchesFilter, matchesSearch } from './clubs/clubOrders';
import type { ClubFilter } from './clubs/clubOrders';
import { buildClubRow } from './clubs/clubRow';
import type { ClubRow } from './clubs/clubRow';
import { ClubCard } from './clubs/ClubCard';
import { useClubSummaries } from '../components/clubs/orders/ClubSummaryCard';
import { prefetchClubPage } from '../api/warmReads';
import { clubCalendarPath, clubPagePath } from '../components/shell/plannerRoutes';
import { PayerDialog } from './clubs/PayerDialog';
import { PinnedActions } from './clubs/PinnedActions';
import { ClubOrderEntry } from '../components/clubs/order/ClubOrderEntry';
import { ClubOrderDetailPanel } from '../components/clubs/orders/ClubOrderDetailPanel';
import { hasOrderState, readOrderState } from '../components/clubs/orders/orderRouteState';

const FILTERS: { key: ClubFilter; label: string }[] = [
  { key: 'all', label: 'Všechny' },
  { key: 'active', label: 'S aktivní rezervací' },
  { key: 'none', label: 'Bez objednávky' },
];

/** What the calendar, the booking drawer or another screen may hand over. */
export interface ClubsRouteState {
  clubId?: string;
  clubBlockId?: string;
}

const readState = (state: unknown): ClubsRouteState | null =>
  state !== null && typeof state === 'object' ? (state as ClubsRouteState) : null;

export default function ClubsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const device = useDevice();
  const phone = device === 'phone';
  const handoff = readState(location.state);
  const orderHandoff = readOrderState(location.state);

  /* "Nová objednávka": the two-way chooser (phone order in the calendar / link for the club); `clubId` may be empty. */
  const [entry, setEntry] = useState<{ clubId?: string } | null>(() =>
    orderHandoff.newOrder === undefined ? null : orderHandoff.newOrder === true ? {} : orderHandoff.newOrder,
  );
  const [openOrderId, setOpenOrderId] = useState<string | null>(orderHandoff.openOrderId ?? null);

  const [filter, setFilter] = useState<ClubFilter>('all');
  const [search, setSearch] = useState('');

  /* `null` closed; a club to change it; `'new'` to add one. */
  const [editing, setEditing] = useState<Club | 'new' | null>(null);

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const list = await clubsApi.getAll(false);
      return Array.isArray(list) ? list : [];
    },
  });

  const blocksQuery = useQuery({
    queryKey: ['club-blocks', 'list'],
    queryFn: () => clubBlocksApi.list(),
    placeholderData: keepPreviousData,
  });
  const allBlocks = useMemo<ClubBlockView[]>(() => blocksQuery.data ?? [], [blocksQuery.data]);

  const calendarsQuery = useQuery({
    queryKey: ['calendars'],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );

  /* Every calendar's orders - a club may be held on any of them. */
  const ordersQueries = useQueries({
    queries: calendars.map((c) => ({
      queryKey: ['partner-orders', c.id],
      queryFn: () => partnerOrdersApi.list(c.id),
    })),
  });
  const orders = useMemo(() => ordersQueries.flatMap((q) => q.data ?? []), [ordersQueries]);
  const ordersLoading = ordersQueries.some((q) => q.isLoading) || blocksQuery.isLoading;
  const ordersFailed = ordersQueries.some((q) => q.isError);
  /* Which calendars' orders are missing, by name, so the note says what the
     cards cannot know rather than "something". */
  const failedOrderCalendars = calendars
    .filter((_c, i) => ordersQueries[i]?.isError)
    .map((c) => c.name);

  /* Etapa 12, prices everywhere: ONE list of every club's orders feeds the "k fakturaci" tile of each card (the same
     query key the orders page uses, so the cache is shared). The cards draw without it when it fails. */
  const clubOrdersQuery = useQuery({
    queryKey: ['club-orders', '', '', ''],
    queryFn: () => clubOrdersApi.list({}),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const billableByClub = useMemo(() => liveTotalsByClub(clubOrdersQuery.data ?? []), [clubOrdersQuery.data]);

  /*
   * The one required read is `/api/clubs`. Everything else on this screen -
   * calendars, each calendar's orders, the club blocks, the price list - is an
   * enrichment: when one fails the cards still draw what is known and this list
   * says which part is missing.
   */
  const missingParts: { what: string; retry: () => void }[] = [];
  if (calendarsQuery.isError) {
    missingParts.push({ what: 'kalendáře (bez nich nelze načíst rezervace)', retry: () => void calendarsQuery.refetch() });
  }
  if (ordersFailed) {
    missingParts.push({
      what: failedOrderCalendars.length > 0
        ? `rezervace kalendářů ${failedOrderCalendars.join(', ')}`
        : 'rezervace některých kalendářů',
      retry: () => ordersQueries.forEach((q) => { if (q.isError) void q.refetch(); }),
    });
  }
  if (blocksQuery.isError) {
    missingParts.push({ what: 'bloky klubů', retry: () => void blocksQuery.refetch() });
  }
  if (clubOrdersQuery.isError) {
    missingParts.push({ what: 'objednávky klubů (částky k fakturaci se nezobrazí)', retry: () => void clubOrdersQuery.refetch() });
  }

  /* Every ACTIVE club's summary in ONE call (a deactivated club gets none); the cards ask per club only when the
     server has no such route yet. */
  const activeClubIds = useMemo(() => (clubsQuery.data ?? []).filter((c) => c.isActive).map((c) => c.id), [clubsQuery.data]);
  const summaryMode = useClubSummaries(activeClubIds);

  const today = toDateOnly(new Date());
  const rows = useMemo<ClubRow[]>(
    () => (clubsQuery.data ?? []).map((club) => buildClubRow(club, orders, allBlocks, today)),
    [clubsQuery.data, orders, allBlocks, today],
  );

  /* Deactivated clubs are archived: hidden from the first three chips, listed under "Neaktivní" when there are any. */
  const liveRows = useMemo(() => rows.filter((r) => r.club.isActive), [rows]);
  const counts = useMemo(
    () => ({
      all: liveRows.length,
      active: liveRows.filter((r) => r.status === 'active').length,
      none: liveRows.filter((r) => r.status === 'none').length,
      inactive: rows.length - liveRows.length,
    }),
    [rows, liveRows],
  );
  const chips = counts.inactive > 0 ? [...FILTERS, { key: 'inactive' as ClubFilter, label: 'Neaktivní' }] : FILTERS;

  const visible = rows.filter(
    (r) => matchesFilter(r.status, filter, r.club.isActive) && matchesSearch(r.club, search),
  );

  /* A club handed over by another screen (the calendar, an invoice, a window on the board): go to its own screen, once.
     A block id without its club: the club is found from the block once the blocks have arrived. */
  const handoffBlockId = handoff?.clubBlockId ?? null;
  useEffect(() => {
    if (hasOrderState(orderHandoff)) {
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (handoff?.clubId !== undefined) {
      /* a window to land on means the calendar; a bare club is its page */
      navigate(handoffBlockId !== null ? clubCalendarPath(handoff.clubId) : clubPagePath(handoff.clubId), { replace: true, state: handoffBlockId !== null ? { clubBlockId: handoffBlockId } : null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a hand-over is read once, on arrival
  }, []);
  useEffect(() => {
    if (handoff?.clubId !== undefined || handoffBlockId === null || blocksQuery.data === undefined) return;
    const owner = blocksQuery.data.find((b) => b.id === handoffBlockId)?.clubId;
    if (owner !== undefined && owner !== '') navigate(clubCalendarPath(owner), { replace: true, state: { clubBlockId: handoffBlockId } });
    else navigate(location.pathname, { replace: true, state: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- as above: once the blocks are known
  }, [blocksQuery.data]);

  const reload = () => {
    void invalidateClubWorld(queryClient);
  };

  const dialogs = (
    <>
      <ClubOrderEntry
        open={entry !== null}
        defaultClubId={entry?.clubId}
        onClose={() => setEntry(null)}
        onPhone={(startClubId) => navigate(startClubId !== undefined ? clubCalendarPath(startClubId) : '/planovani', { state: { pickOrder: startClubId !== undefined ? { clubId: startClubId } : true } })}
        onInvited={(invited) => { reload(); setOpenOrderId(invited.id); }}
      />
      {openOrderId !== null ? (
        <ClubOrderDetailPanel orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={reload} />
      ) : null}
      {editing !== null ? <PayerDialog editing={editing} onClose={() => setEditing(null)} onSaved={reload} /> : null}
    </>
  );

  /* ── The page: Čeká na vás (club inquiries, only when there are any), the clubs this person opened or pinned, the clubs ── */

  const columns = phone ? 1 : device === 'tablet' ? 2 : 3;
  /* R10 next step: inquiries a club sent and nobody answered yet; read from the one orders list the cards already use. */
  const inquiries = clubOrdersQuery.data === undefined ? null : clubInquiries({ now: new Date(), clubOrders: clubOrdersQuery.data });
  const newClub = () => setEditing('new');
  const newOrder = () => setEntry({});

  const filters = (
    <Box
      data-filters={phone ? 'scroll' : 'wrap'}
      sx={phone ? { order: 3, flexBasis: '100%', overflowX: 'auto', mx: -2, px: 2, pb: 0.5, '& [role="group"]': { flexWrap: 'nowrap' }, '& button': { flexShrink: 0, minHeight: 44 } } : undefined}
    >
      <FilterChips
        ariaLabel="Filtr klubů"
        options={chips.map((f) => ({ ...f, count: counts[f.key] }))}
        value={filter}
        onChange={setFilter}
      />
    </Box>
  );

  return (
    <PageFrame
      fit
      title="Kluby a týmy"
      purpose={clubsQuery.data === undefined ? 'Hromadné objednávky a registrační odkazy' : `Hromadné objednávky a registrační odkazy · ${counts.all} ${counts.all === 1 ? 'klub' : counts.all >= 2 && counts.all <= 4 ? 'kluby' : 'klubů'}`}
      /* a phone pins both actions at the bottom (PinnedActions), so the frame pins nothing of its own */
      primaryAction={phone ? undefined : { label: 'Nová objednávka', icon: <Add />, onClick: newOrder }}
      actions={phone ? undefined : <Button variant="outlined" onClick={newClub} sx={TARGET_SX}>Nový klub</Button>}
    >
      {inquiries !== null && (
        <Shelf id="club-inquiries" title="Čeká na vás" count={inquiries.count} countTone="red" layout="row" minCardWidth={340} stagger={false}>
          <AttentionCard group={inquiries} />
        </Shelf>
      )}

      <RecentAndPinned kinds={['club']} dense hideWhenEmpty limit={6} title="Připnuté a nedávné" hint="Kluby, ke kterým se vracíte" />

      <Shelf
        id="clubs"
        title="Kluby"
        count={clubsQuery.isLoading || clubsQuery.isError ? undefined : visible.length}
        layout="free"
        grow
        controls={clubsQuery.isLoading || clubsQuery.isError || rows.length === 0 ? undefined : filters}
        loading={clubsQuery.isLoading}
        error={clubsQuery.isError ? 'Kluby se nepodařilo načíst.' : false}
        onRetry={() => void clubsQuery.refetch()}
        empty={rows.length === 0}
        emptyState={{ text: 'Zatím tu žádný klub není. Přidejte klub, který objednává prohlídky pro své sportovce.', action: { label: 'Nový klub', onClick: newClub } }}
      >
        <TextField
          fullWidth
          size={phone ? 'medium' : 'small'}
          placeholder="Název klubu nebo kontaktní osoba"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 1.5, flexShrink: 0 }}
          slotProps={{
            input: {
              sx: { minHeight: 44 },
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Hledat klub' },
          }}
        />

        {missingParts.length > 0 ? (
          <Alert
            severity="warning"
            sx={{ mb: 1.5, flexShrink: 0 }}
            action={
              <Button color="inherit" size="small" onClick={() => missingParts.forEach((p) => p.retry())} sx={TARGET_SX}>
                Zkusit znovu
              </Button>
            }
          >
            Nepodařilo se načíst: {missingParts.map((p) => p.what).join(' · ')}. Karty ukazují jen to, co je známo.
          </Alert>
        ) : null}

        {visible.length === 0 ? (
          <Box data-testid="clubs-list" data-layout={device} data-columns={columns} sx={(t) => ({ ...cardSurface(t, false), p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', borderStyle: 'dashed' })}>
            <Typography sx={{ ...MUTED_SX, flex: '1 1 220px', fontSize: 14 }}>Tomuto filtru neodpovídá žádný klub.</Typography>
            <Button variant="outlined" size="small" onClick={() => { setFilter('all'); setSearch(''); }} sx={TARGET_SX}>Zobrazit všechny</Button>
          </Box>
        ) : (
          /* The clubs are the rest of the screen: the cards scroll inside the shelf, the page does not (a phone's page flows). */
          <Box
            role="list"
            aria-label="Kluby"
            data-testid="clubs-list"
            data-layout={device}
            data-columns={columns}
            sx={{
              display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: phone ? 1.5 : 2,
              /* rows as tall as their card: `auto` rows of a box with a fixed height would shrink to the cards' min-height */
              gridAutoRows: 'max-content', alignContent: 'start',
              /* the first card's focus ring and shadow are not clipped by the scroller */
              p: '4px', m: '-4px',
              ...(phone ? {} : { ...FIT_FILL_SX, ...FIT_SCROLL_SX }),
            }}
          >
            {visible.map((row) => (
              <ClubCard
                key={row.club.id}
                row={row}
                ordersLoading={ordersLoading}
                summaryRequest={summaryMode === 'single'}
                billableCzk={clubOrdersQuery.isLoading ? undefined : (billableByClub.get(row.club.id) ?? null)}
                onOpen={() => navigate(clubPagePath(row.club.id))}
                onPrefetch={() => prefetchClubPage(queryClient, row.club.id)}
              />
            ))}
          </Box>
        )}
      </Shelf>

      <PinnedActions>
        <Button variant="outlined" onClick={newClub}>Nový klub</Button>
        <Button variant="contained" onClick={newOrder}>Nová objednávka</Button>
      </PinnedActions>

      {dialogs}
    </PageFrame>
  );
}
