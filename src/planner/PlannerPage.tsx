/*
 * PlannerPage - the planner as a page of the application: the composition behind the `/planovani` route (it
 * replaced the old `CalendarGridPage`; the router state other screens send there is read by the board and below).
 *
 *   data       `ApiDataSource` over the application's API clients (`useApiDataSource`), standard booking
 *              or - when a club order is being planned - that order. `?source=demo` swaps in the lab's
 *              in-memory demo data (for a day the API is down; nothing is written anywhere).
 *   mode       decided from the router state exactly like the calendar page does it:
 *                `pickOrder.start`   a PickSession: club planning (the whole planner interface, for PL-E's layers)
 *                `pickOrder` without a session (a club's card, "Klub" on the board, "Vyplním sám"): the small
 *                                    setup form first, then the same
 *                nothing             standard ordering: the same board, the header shows the clinic's own data
 *   board      `realCalendar`: the board reads the clinic's real calendar (bookings, blocks, filters) on top of
 *              the planner's data, and offers "Nová objednávka" / "Klubová objednávka".
 *   club       `/clubs/:clubId` (`clubId` prop): the same screen for ONE club - its data in the header, the club's
 *              windows on the board, every action of the old club page reachable from the planner (see `club/`).
 *              It OPENS AS THE CLUB'S OVERVIEW (reviewer 2.3): the same layout in the club's context
 *              (`ApiDataSource.clubContext`), the order the switcher names (`?order=`) in view and the quick actions
 *              in the deck. The order is put on the stage for planning only by a planning action: `?plan=1`
 *              ("Plánovat termíny", "Upravit termíny"), or a session the router state hands over.
 *   prices     the old sidebar's SLUŽBY legend is gone; the služba filter is the gear's "Služby" row
 *              (`boardSettings.serviceSet`) and a činnost's price stands next to its name in the agenda
 *              (`AgendaPanel`), the činnost filter lists and the board's term bubbles.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PickOrderSetup } from '../components/clubs/order/PickOrderSetup';
import { readPickOrderState, type PickSession } from '../components/clubs/order/pickSession';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { pragueDateKey } from '../utils/time';
import { useCalendarDisplay } from '../api/displaySettings';
import { ClubPlannerProvider } from './club/ClubPlannerContext';
import { useClubPlannerData, type ClubPlannerData } from './club/useClubPlannerData';
import { useApiDataSource } from './api/useApiDataSource';
import { PlannerShell } from './components/PlannerShell';
import { BoardConfigProvider, type BoardConfig } from './components/board/boardConfig';
import { boardSettings } from './components/board/boardSettings';
import { useDemoDataSource } from './data/useDemoDataSource';
import type { PlannerDataSource } from './data/PlannerDataSource';

function storedUser(): { displayName: string } | null {
  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as { firstName?: string; lastName?: string };
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return name ? { displayName: name } : null;
  } catch {
    return null;
  }
}

/** A short stable id of what the club screen shows, so two orders never share the planner's query cache. */
function hashOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The planner as a page: the everyday calendar on `/planovani`, one club's screen on `/clubs/:clubId`. */
export default function PlannerPage({ clubId }: { clubId?: string } = {}) {
  return clubId ? <ClubPlannerScreen clubId={clubId} /> : <PlannerScreen club={null} />;
}

/** `/clubs/:clubId`: load the club and its orders, then draw the planner in the club's context. */
function ClubPlannerScreen({ clubId }: { clubId: string }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const today = useMemo(() => pragueDateKey(new Date()), []);
  const orderId = params.get('order');
  /* "Plan now": a planning action put `plan=1` in the address. A club opened from the list, a card, a link is its overview. */
  const planning = params.get('plan') === '1';
  /* the router state a club window / a club card hands over (spent by the screen, never by the URL) */
  const blockId = (location.state as { clubBlockId?: string } | null)?.clubBlockId ?? null;
  const pick = readPickOrderState(location.state);
  /* the session the router state carries goes in too: the stage's reads start for what the stage will really plan */
  const data = useClubPlannerData(clubId, today, { orderId, blockId, session: pick?.start ?? null, planning });

  if (data.status === 'loading') {
    /* the same box the planner page then fills (height, min height, width): the swap moves nothing */
    return (
      <Box data-testid="club-planner-loading" role="status" aria-busy="true" sx={{ display: 'grid', placeItems: 'center', height: 'calc(100vh - 32px)', minHeight: 520, width: '100%' }}>
        <CircularProgress aria-label="Načítám klub" />
      </Box>
    );
  }
  if (data.status !== 'ready' || data.club === null) {
    return (
      <Box data-testid="club-planner-error" sx={{ maxWidth: 560, mx: 'auto', mt: 6 }}>
        <Alert severity={data.status === 'notFound' ? 'warning' : 'error'} action={data.status === 'notFound' ? undefined : <Button color="inherit" size="small" onClick={data.refetch}>Zkusit znovu</Button>}>
          {data.status === 'notFound' ? 'Tento klub neexistuje.' : 'Klub se nepodařilo načíst.'}
        </Alert>
        <Button component={RouterLink} to="/clubs" sx={{ mt: 2 }}>Zpět na kluby</Button>
      </Box>
    );
  }

  /* A session the router state carries (a new order, a request being processed, players changed in a dialog) is what
     the stage plans; otherwise the selected group's. */
  const routerSession = pick?.start ?? null;
  const adhoc: 'new' | 'edit' | null = routerSession === null ? null : routerSession.editOrder ? 'edit' : 'new';
  const effective: ClubPlannerData = routerSession === null
    ? data
    : {
        ...data,
        session: routerSession,
        selected: routerSession.editOrder ? (data.groups.find((g) => g.orders.some((o) => o.id === routerSession.editOrder?.orderId)) ?? null) : null,
        openOn: routerSession.editOrder?.firstDate ?? data.today,
      };
  return (
    <ClubPlannerProvider data={effective} club={data.club} adhoc={adhoc} planning={effective.session !== null}>
      <PlannerScreen club={effective} />
    </ClubPlannerProvider>
  );
}

function PlannerScreen({ club }: { club: ClubPlannerData | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demo = params.get('source') === 'demo';
  const today = useMemo(() => pragueDateKey(new Date()), []);
  const user = useMemo(() => storedUser(), []);
  /* The clinic's "Výchozí pohled": the standard calendar opens in it (a club's planning stage and the demo keep the week). */
  const display = useCalendarDisplay();

  /* ---- the mode, from the router state ---- */
  const pick = readPickOrderState(location.state);
  const session: PickSession | null = club !== null ? club.session : (pick?.start ?? null);
  const needsSetup = pick !== null && pick.start === undefined;
  const mode: BoardConfig['mode'] = session !== null || club !== null ? 'club' : 'standard';

  const startWith = useCallback(
    (next: PickSession) => navigate(location.pathname + location.search, { replace: true, state: { pickOrder: { start: next } } }),
    [navigate, location.pathname, location.search],
  );
  const closeSetup = useCallback(
    () => navigate(location.pathname + location.search, { replace: true, state: null }),
    [navigate, location.pathname, location.search],
  );

  /* While a club order is planned only the order's služba is shown; the filter comes back afterwards. */
  const saved = useRef<ReturnType<typeof boardSettings.getState>['serviceSet'] | undefined>(undefined);
  const sessionServiceId = session?.serviceId ?? null;
  useEffect(() => {
    if (sessionServiceId === null) return undefined;
    saved.current = boardSettings.getState().serviceSet;
    boardSettings.onlyService(sessionServiceId);
    return () => {
      const before = saved.current;
      saved.current = undefined;
      if (before === null || before === undefined) boardSettings.showAllServices();
      else boardSettings.onlyService([...before][0] ?? sessionServiceId);
    };
  }, [sessionServiceId]);

  /* ---- the data source ---- */
  const clubSourceId = club === null ? null : `api:club:${club.club?.id ?? ''}:${hashOf(JSON.stringify(session))}`;
  const api = useApiDataSource(
    club === null || clubSourceId === null
      ? { session, today }
      : { session, today, id: clubSourceId, clubContext: { clubId: club.club?.id ?? '', clubName: club.club?.name ?? '' } },
  );
  /* `?source=demo` fetches the demo code on demand (it is not part of the planner's own script). */
  const demoSource = useDemoDataSource(demo, { today });
  const source: PlannerDataSource = demoSource ?? api;

  /* On a club's own screen the club's other windows stay on the board; only the edited order's are the draft's. */
  const inClub = club !== null;
  const ownBlocks = useMemo(() => new Set((session?.editOrder?.blocks ?? []).map((b) => b.id)), [session]);
  /* The order whose request is being processed: its inquiry days read "Klub žádá". */
  const inquiryOrderId = session?.editOrder?.mode === 'process' ? session.editOrder.orderId : null;
  const config = useMemo<BoardConfig>(
    () => (!inClub
      ? { realCalendar: true, mode, excludeClubId: session?.clubId ?? null, inquiryOrderId }
      : { realCalendar: true, mode, excludeClubId: null, excludeClubBlockIds: ownBlocks, inquiryOrderId }),
    [mode, session?.clubId, inClub, ownBlocks, inquiryOrderId],
  );

  if (demo && demoSource === null) {
    return (
      <Box data-testid="planner-demo-loading" sx={{ display: 'grid', placeItems: 'center', height: 'calc(100vh - 32px)', minHeight: 520 }}>
        <CircularProgress aria-label="Načítám ukázková data" />
      </Box>
    );
  }
  return (
    <BoardConfigProvider value={config}>
      <div style={{ height: 'calc(100vh - 32px)', minHeight: 520, width: '100%' }} data-testid="planner-page" data-mode={mode}>
        <PlannerShell
          key={`${source.id}:${session ? `${session.clubId}:${session.editOrder?.orderId ?? 'new'}` : club !== null ? 'club' : 'standard'}`}
          source={source}
          today={today}
          initialDate={club !== null ? club.openOn : today}
          user={user}
          headerMode={mode === 'club' ? 'club' : 'clinic'}
          defaultView={mode === 'standard' && !demo && display.loaded ? display.settings.defaultView : undefined}
        />
      </div>
      {needsSetup ? <PickOrderSetup open defaultClubId={pick?.clubId} parent={pick?.parent} onClose={closeSetup} onStart={startWith} /> : null}
    </BoardConfigProvider>
  );
}
