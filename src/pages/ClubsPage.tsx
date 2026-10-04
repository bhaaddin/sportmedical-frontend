/*
 * Kluby a týmy - design board 3. 10. 2026, screens 16 and 17, in three layouts
 * (phone: cards in one column and the actions pinned to the bottom; tablet: two
 * columns; desktop: the board's three).
 *
 * One screen, two views (the opened club is a presentation page, components/clubs/detail).
 * a reservation or a block running, who to call, how many athletes it brings and
 * the discount the administrator gave it. Opening a card shows the club's
 * blocks and bulk reservation - the athletes' registration link, how many of the
 * places are taken, who took them - and on the right the club's facts and the
 * order's money.
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
 *   { clubId }                       open that club's detail
 *   { clubId, clubBlockId }          ... and land on that block
 *   { clubBlockId }                  the same, the club is found from the block
 *   { newBlock: NewBlockPrefill }    open the new-block dialog; a club that does
 *                                    not exist yet (`newClub`) is created with it
 *
 * The payer record itself - IČO, fakturační adresa, bankovní spojení - is still
 * edited here ("Upravit klub", "Nový klub"), because an invoice to a club
 * needs all of that and the day it is due is the wrong day to find it missing.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, InputAdornment, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubsApi } from '../api/clubs';
import type { Club } from '../api/clubs';
import { calendarsApi } from '../api/calendars';
import { activitiesApi } from '../api/activities';
import { clubBlocksApi } from '../api/clubBlocks';
import type { ClubBlockView } from '../api/clubBlocks';
import { partnerOrdersApi } from '../api/partnerOrders';
import { useDevice } from '../layout/useDevice';
import { toDateOnly } from '../utils/time';
import { FilterChips, PageHeader, SoftCard } from '../components/ui';
import { ClubBlockDialog, isNewBlockPrefill } from '../components/clubs/ClubBlockDialog';
import type { NewBlockPrefill } from '../components/clubs/ClubBlockDialog';
import { matchesFilter, matchesSearch } from './clubs/clubOrders';
import type { ClubFilter } from './clubs/clubOrders';
import { buildClubRow } from './clubs/clubRow';
import type { ClubRow } from './clubs/clubRow';
import { ClubCard } from './clubs/ClubCard';
import { ClubPresentation } from '../components/clubs/detail/ClubPresentation';
import { PayerDialog } from './clubs/PayerDialog';
import { PinnedActions } from './clubs/PinnedActions';
import { ClubOrderDialog } from '../components/clubs/order/ClubOrderDialog';
import { ClubOrderEntry } from '../components/clubs/order/ClubOrderEntry';
import { ClubOrderDetailPanel } from '../components/clubs/orders/ClubOrderDetailPanel';
import { hasOrderState, readOrderState } from '../components/clubs/orders/orderRouteState';
import type { NewOrderPrefill } from '../components/clubs/orders/orderRouteState';

const FILTERS: { key: ClubFilter; label: string }[] = [
  { key: 'all', label: 'Všechny' },
  { key: 'active', label: 'S aktivní rezervací' },
  { key: 'none', label: 'Bez objednávky' },
];

/** What the calendar, the booking drawer or another screen may hand over. */
export interface ClubsRouteState {
  clubId?: string;
  clubBlockId?: string;
  /** `true` opens an empty dialog; an object pre-fills it. */
  newBlock?: NewBlockPrefill | true;
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

  /* Etapa 4: the order dialog (new, optionally prefilled) and an order's detail drawer. */
  /* The club page's "Nová objednávka klubu": the two-way chooser (phone order in the calendar / link for the club). */
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [orderDialog, setOrderDialog] = useState<NewOrderPrefill | null>(() =>
    orderHandoff.newOrder === undefined ? null : orderHandoff.newOrder === true ? {} : orderHandoff.newOrder,
  );
  const [openOrderId, setOpenOrderId] = useState<string | null>(orderHandoff.openOrderId ?? null);

  const [filter, setFilter] = useState<ClubFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(handoff?.clubId ?? null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(handoff?.clubBlockId ?? null);

  /* `null` closed; a club to change it; `'new'` to add one. */
  const [editing, setEditing] = useState<Club | 'new' | null>(null);
  /* `null` closed; otherwise the head start of the new-block dialog. */
  const [blockDialog, setBlockDialog] = useState<NewBlockPrefill | null>(() =>
    handoff?.newBlock === undefined ? null : isNewBlockPrefill(handoff.newBlock) ? handoff.newBlock : {},
  );

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

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: activitiesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const priceOf = (activityId: string): number | null =>
    (activitiesQuery.data?.activities ?? []).find((a) => a.id === activityId)?.priceCzk ?? null;

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
  if (activitiesQuery.isError) {
    missingParts.push({ what: 'ceník činností (částky objednávek se nezobrazí)', retry: () => void activitiesQuery.refetch() });
  }

  const today = toDateOnly(new Date());
  const rows = useMemo<ClubRow[]>(
    () => (clubsQuery.data ?? []).map((club) => buildClubRow(club, orders, allBlocks, today)),
    [clubsQuery.data, orders, allBlocks, today],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      none: rows.filter((r) => r.status === 'none').length,
    }),
    [rows],
  );

  const visible = rows.filter((r) => matchesFilter(r.status, filter) && matchesSearch(r.club, search));
  const selected = selectedId === null ? null : (rows.find((r) => r.club.id === selectedId) ?? null);

  /* Spend the handoff once it has done its job, so Back does not reopen it.
     Mount-only on purpose: everything it carried has been read into state. */
  useEffect(() => {
    if (hasOrderState(orderHandoff) || (handoff !== null && (handoff.clubId !== undefined || handoff.clubBlockId !== undefined || handoff.newBlock !== undefined))) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, []);

  /* A block id without its club: find the club once the blocks have arrived. */
  useEffect(() => {
    if (selectedId === null && focusBlockId !== null && blocksQuery.data !== undefined) {
      const owner = blocksQuery.data.find((b) => b.id === focusBlockId)?.clubId;
      if (owner !== undefined && owner !== '') setSelectedId(owner);
    }
  }, [selectedId, focusBlockId, blocksQuery.data]);

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['clubs'] });
    void queryClient.invalidateQueries({ queryKey: ['partner-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Deaktivovat klub ${name}?`)) return;
    try {
      await clubsApi.deactivate(id);
      toast.success('Klub deaktivován');
      if (selectedId === id) setSelectedId(null);
      reload();
    } catch {
      toast.error('Akce selhala');
    }
  };

  const dialogs = (
    <>
      <ClubOrderEntry
        open={entryFor !== null}
        defaultClubId={entryFor ?? undefined}
        onClose={() => setEntryFor(null)}
        onPhone={(startClubId) => navigate('/planovani', { state: { pickOrder: startClubId !== undefined ? { clubId: startClubId } : true } })}
        onInvited={(invited) => { reload(); setOpenOrderId(invited.id); }}
      />
      <ClubOrderDialog
        open={orderDialog !== null}
        onClose={() => setOrderDialog(null)}
        initial={orderDialog ?? undefined}
        onSaved={(saved) => {
          setOrderDialog(null);
          if (saved.clubId !== '') setSelectedId(saved.clubId);
          setOpenOrderId(saved.id);
          reload();
        }}
      />
      {openOrderId !== null ? (
        <ClubOrderDetailPanel orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={reload} />
      ) : null}
      {editing !== null ? <PayerDialog editing={editing} onClose={() => setEditing(null)} onSaved={reload} /> : null}
      {blockDialog !== null ? (
        <ClubBlockDialog
          clubs={clubsQuery.data ?? []}
          prefill={blockDialog}
          blocks={allBlocks}
          onClose={() => setBlockDialog(null)}
          onSaved={(saved) => {
            if (saved.clubId !== '') setSelectedId(saved.clubId);
            setFocusBlockId(saved.id);
          }}
        />
      ) : null}
    </>
  );

  /* ── Loading and failure ── */

  if (clubsQuery.isLoading) {
    const columns = phone ? 1 : device === 'tablet' ? 2 : 3;
    return (
      <Box>
        <Skeleton variant="rounded" height={48} sx={{ mb: 2.5, maxWidth: 420 }} />
        <Skeleton variant="rounded" height={44} sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 2 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={150} />)}
        </Box>
      </Box>
    );
  }

  if (clubsQuery.isError) {
    return (
      <Box>
        <PageHeader title="Kluby a týmy" subtitle="Hromadné objednávky a registrační odkazy" />
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => void clubsQuery.refetch()}>Zkusit znovu</Button>}
        >
          Kluby se nepodařilo načíst.
        </Alert>
      </Box>
    );
  }

  /* ── Detail: design-17 ── */

  if (selected !== null) {
    return (
      <Box>
        <ClubPresentation
          row={selected}
          clubs={clubsQuery.data ?? []}
          allBlocks={allBlocks}
          priceOf={priceOf}
          pricesReady={activitiesQuery.isSuccess || activitiesQuery.isError}
          today={today}
          focusBlockId={focusBlockId}
          onBack={() => { setSelectedId(null); setFocusBlockId(null); }}
          onEdit={() => setEditing(selected.club)}
          onDeactivate={() => void remove(selected.club.id, selected.club.name)}
          onReload={reload}
          onInvoice={() =>
            navigate('/billing', { state: { clubId: selected.club.id, partnerOrderId: selected.order?.id ?? null } })
          }
          onNewReservation={() =>
            navigate('/vyhrazeni', {
              state: { clubId: selected.club.id, calendarId: selected.order?.calendarId ?? calendars[0]?.id },
            })
          }
          onNewOrder={() => setEntryFor(selected.club.id)}
          onOpenOrder={setOpenOrderId}
        />
        {dialogs}
      </Box>
    );
  }

  /* ── List: design-16 ── */

  const columns = phone ? 1 : device === 'tablet' ? 2 : 3;

  return (
    <Box data-testid="clubs-list" data-layout={device} data-columns={columns}>
      <PageHeader
        title="Kluby a týmy"
        subtitle="Hromadné objednávky a registrační odkazy"
        actions={
          phone ? undefined : (
            <>
              <Button variant="outlined" onClick={() => setEditing('new')}>Nový klub</Button>
              <Button variant="contained" onClick={() => setOrderDialog({})}>Nová objednávka</Button>
            </>
          )
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5, alignItems: { md: 'center' } }}>
        <TextField
          fullWidth
          size={phone ? 'medium' : 'small'}
          placeholder="Název klubu nebo kontaktní osoba"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Hledat klub' },
          }}
        />
        <FilterChips
          ariaLabel="Filtr klubů"
          options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
          value={filter}
          onChange={setFilter}
        />
      </Stack>

      {missingParts.length > 0 ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => missingParts.forEach((p) => p.retry())}>
              Zkusit znovu
            </Button>
          }
        >
          Nepodařilo se načíst: {missingParts.map((p) => p.what).join(' · ')}. Karty ukazují jen to, co je známo.
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <SoftCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Zatím tu žádný klub není.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Přidejte klub nebo organizaci, která objednává prohlídky pro své sportovce.
          </Typography>
          <Button variant="contained" onClick={() => setEditing('new')} sx={{ minHeight: 44 }}>Nový klub</Button>
        </SoftCard>
      ) : visible.length === 0 ? (
        <SoftCard sx={{ textAlign: 'center', py: 5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tomuto filtru neodpovídá žádný klub.
          </Typography>
        </SoftCard>
      ) : (
        <Box
          role="list"
          aria-label="Kluby"
          sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: phone ? 1.5 : 2 }}
        >
          {visible.map((row) => (
            <ClubCard
              key={row.club.id}
              row={row}
              ordersLoading={ordersLoading}
              onOpen={() => setSelectedId(row.club.id)}
            />
          ))}
        </Box>
      )}

      <PinnedActions>
        <Button variant="outlined" onClick={() => setEditing('new')}>Nový klub</Button>
        <Button variant="contained" onClick={() => setOrderDialog({})}>Nová objednávka</Button>
      </PinnedActions>

      {dialogs}
    </Box>
  );
}
