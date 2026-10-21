/*
 * The club's planner screen around the stage: what the planner's own panels (the header's order switcher, the order
 * overview dialog, the empty deck) need from the club, and the application's existing dialogs that the club's actions
 * open - the club's order entry, an order's own panel, "Přidat hráče / rozšířit", "Odebrat hráče", "Zrušit objednávku",
 * "Sloučit do jedné objednávky". Nothing here is new logic: every dialog is the one the old club page mounted, every
 * action calls what that page called; the planner only reaches them from its own buttons.
 *
 * Mounted by `PlannerPage` on `/clubs/:clubId` (`useClubPlanner()` is null on every other route, so the planner's panels
 * draw exactly as before there).
 */
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, createContext, lazy, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clubsApi, type Club } from '../../api/clubs';
import type { ClubOrderView } from '../../api/clubOrders';
import { invalidateClubWorld } from '../../components/clubs/clubWorld';
import { ClubOrderEntry } from '../../components/clubs/order/ClubOrderEntry';
import type { CoverageActivity } from '../../components/clubs/order/coverage';
import { editSessionFor } from '../../components/clubs/order/editSession';
import { fetchBlockableActivities } from '../../api/clubBlocks';
import { todayInPrague } from '../../components/clubs/blockLogic';
import { CancelOrderDialog } from '../../components/clubs/orders/CancelOrderDialog';
import { ChangePlayersDialog } from '../../components/clubs/orders/ChangePlayersDialog';
/* The order's own panel opens on demand: it is a chunk of its own, not part of the planner's first load (bundle budget). */
const ClubOrderDetailPanel = lazy(() =>
  import('../../components/clubs/orders/ClubOrderDetailPanel').then((m) => ({ default: m.ClubOrderDetailPanel })),
);
import { MergeOrdersDialog } from '../../components/clubs/detail/MergeOrdersDialog';
import { mergeableRoots } from '../../components/clubs/detail/orderGroups';
import type { ClubGroup } from './clubGroups';
import type { ClubPlannerData } from './useClubPlannerData';

export interface ClubPlannerValue {
  club: Club;
  data: ClubPlannerData;
  groups: ClubGroup[];
  /** The group in view (null: the club has no live order). */
  selected: ClubGroup | null;
  /** A planning session that came from the router state (a new order; an order's terms with players changed) rather than from a group. */
  adhoc: 'new' | 'edit' | null;
  /**
   * The stage is planning an order. False is the club's OVERVIEW (reviewer 2.3): the layout of the planner in the club's
   * context - club header, the order in view, its windows on the board - with the quick actions in the deck.
   */
  planning: boolean;
  /** Show another group of the club (in the mode the screen is in: a planning screen keeps planning). */
  select: (groupId: string) => void;
  /** "Plánovat termíny": put this group on the stage for planning (`plan=1`). */
  planGroup: (groupId: string) => void;
  /** Back to the club's overview (no planning, the same group in view). */
  leavePlanning: () => void;
  /** "Nová objednávka klubu": the two-way chooser (phone order here / link for the club). */
  newOrder: () => void;
  /** "Vytvořit rezervaci": the small setup form on this screen. */
  newReservation: () => void;
  /** An order's own panel (`ClubOrderDetailPanel`: contact, links, history, windows, invoice). */
  openOrder: (orderId: string) => void;
  changePlayers: (order: ClubOrderView, intent: 'add' | 'remove') => void;
  cancelOrder: (order: ClubOrderView) => void;
  mergeOrders: () => void;
  /** "Upravit termíny": the planner arms on that order (the group opens on the stage; `activities` = players changed in the dialog). */
  editTerms: (order: ClubOrderView, activities?: CoverageActivity[]) => void;
  deactivate: () => Promise<void>;
  reload: () => void;
}

const ClubPlannerContext = createContext<ClubPlannerValue | null>(null);

/** The club behind the planner screen; null on every route that is not a club's. */
export const useClubPlanner = (): ClubPlannerValue | null => useContext(ClubPlannerContext);

type Intent = 'add' | 'remove';

export function ClubPlannerProvider({ data, club, adhoc, planning, children }: { data: ClubPlannerData; club: Club; adhoc: 'new' | 'edit' | null; planning: boolean; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [players, setPlayers] = useState<{ order: ClubOrderView; intent: Intent } | null>(null);
  const [cancelling, setCancelling] = useState<ClubOrderView | null>(null);
  const [merging, setMerging] = useState(false);

  const reload = useCallback(() => {
    void invalidateClubWorld(queryClient);
  }, [queryClient]);

  /* The group in view is the URL's (`?order=`): a link keeps it, the back button returns to it. Planning is `plan=1` beside it. */
  const urlOf = useCallback((groupId: string, plan: boolean) => `?order=${encodeURIComponent(groupId)}${plan ? '&plan=1' : ''}`, []);
  const select = useCallback(
    (groupId: string) => navigate({ pathname: location.pathname, search: urlOf(groupId, planning && adhoc === null) }, { replace: true, state: null }),
    [navigate, location.pathname, urlOf, planning, adhoc],
  );
  const planGroup = useCallback(
    (groupId: string) => navigate({ pathname: location.pathname, search: urlOf(groupId, true) }, { replace: true, state: null }),
    [navigate, location.pathname, urlOf],
  );
  const leavePlanning = useCallback(
    () => navigate({ pathname: location.pathname, search: data.selected ? urlOf(data.selected.id, false) : '' }, { replace: true, state: null }),
    [navigate, location.pathname, urlOf, data.selected],
  );

  const newReservation = useCallback(
    () => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { pickOrder: { clubId: club.id } } }),
    [navigate, location.pathname, location.search, club.id],
  );

  const editTerms = useCallback(
    async (order: ClubOrderView, activities?: CoverageActivity[]) => {
      setPlayers(null);
      if (activities === undefined) {
        /* The root of a Confirmed group IS what the stage plans; anything else opens on its group. */
        const group = data.groups.find((g) => g.orders.some((o) => o.id === order.id));
        if (group !== undefined) { planGroup(group.id); return; }
      }
      const catalogue = await fetchBlockableActivities();
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: { pickOrder: { start: editSessionFor(order, catalogue, todayInPrague(), activities) } } },
      );
    },
    [data.groups, navigate, location.pathname, location.search, planGroup],
  );

  const deactivate = useCallback(async () => {
    if (!window.confirm(`Deaktivovat klub ${club.name}?`)) return;
    try {
      await clubsApi.deactivate(club.id);
      toast.success('Klub deaktivován');
      reload();
      navigate('/clubs');
    } catch {
      toast.error('Akce selhala');
    }
  }, [club.id, club.name, navigate, reload]);

  const value = useMemo<ClubPlannerValue>(
    () => ({
      club,
      data,
      groups: data.groups,
      selected: data.selected,
      adhoc,
      planning,
      select,
      planGroup,
      leavePlanning,
      newOrder: () => setEntry(true),
      newReservation,
      openOrder: setOpenOrderId,
      changePlayers: (order, intent) => setPlayers({ order, intent }),
      cancelOrder: setCancelling,
      mergeOrders: () => setMerging(true),
      editTerms: (order, activities) => void editTerms(order, activities),
      deactivate,
      reload,
    }),
    [club, data, adhoc, planning, select, planGroup, leavePlanning, newReservation, editTerms, deactivate, reload],
  );

  const mergeable = mergeableRoots(data.groups);

  return (
    <ClubPlannerContext.Provider value={value}>
      {children}
      <ClubOrderEntry
        open={entry}
        defaultClubId={club.id}
        onClose={() => setEntry(false)}
        onPhone={() => { setEntry(false); newReservation(); }}
        onInvited={(invited) => { reload(); setOpenOrderId(invited.id); }}
      />
      {openOrderId !== null ? (
        <Suspense fallback={null}>
          <ClubOrderDetailPanel orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={reload} />
        </Suspense>
      ) : null}
      {players !== null ? (
        <ChangePlayersDialog
          order={players.order}
          intent={players.intent}
          onClose={() => setPlayers(null)}
          onSaved={() => { setPlayers(null); reload(); }}
          onEditTerms={players.order.status === 'Confirmed' ? (activities) => void editTerms(players.order, activities) : undefined}
        />
      ) : null}
      {cancelling !== null ? <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} onCancelled={() => { setCancelling(null); reload(); }} /> : null}
      {merging ? <MergeOrdersDialog orders={mergeable} onClose={() => setMerging(false)} onMerged={() => { setMerging(false); reload(); }} /> : null}
    </ClubPlannerContext.Provider>
  );
}
