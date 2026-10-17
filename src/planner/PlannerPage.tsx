/*
 * PlannerPage - the planner as a page of the application, the composition that will take the place of
 * `CalendarGridPage` on `/planovani` (a later step switches the route; until then it is mounted at
 * `/planner-lab/page`).
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
 *   sidebar    the SLUŽBY legend with prices. The stage replaces the old sidebar's mini calendar (it has its
 *              own), but nothing in it replaces the legend - the služba filter and the prices per služba - so
 *              it keeps living in the shell's sidebar slot (`SidebarPortal`), standard ordering only. It is
 *              the same `boardSettings.serviceSet` filter the gear's "Služby" row edits.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { PickOrderSetup } from '../components/clubs/order/PickOrderSetup';
import { readPickOrderState, type PickSession } from '../components/clubs/order/pickSession';
import { ServiceLegend, useServicePrices } from '../components/booking/grid/GridSidebar';
import { SidebarPortal } from '../components/shell/SidebarSlot';
import { pragueDateKey } from '../utils/time';
import { useApiDataSource } from './api/useApiDataSource';
import { PlannerShell } from './components/PlannerShell';
import { BoardConfigProvider, type BoardConfig } from './components/board/boardConfig';
import { boardSettings, useBoardSettings } from './components/board/boardSettings';
import { DemoDataSource } from './data/DemoDataSource';
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

/** SLUŽBY: a colour square, the name and the price range of each služba; the square filters the board. */
function ServiceLegendPortal() {
  const { facets, serviceSet } = useBoardSettings();
  const prices = useServicePrices(facets.services);
  const ids = facets.services.map((s) => s.id);
  if (facets.services.length === 0) return null;
  return (
    <SidebarPortal>
      <Box sx={{ pb: 2 }} data-testid="planner-service-legend">
        <ServiceLegend
          services={facets.services}
          prices={prices}
          isShown={(id) => serviceSet === null || serviceSet.has(id)}
          onToggle={(id) => boardSettings.toggleService(id, ids)}
          onOnly={(id) => boardSettings.onlyService(id)}
          onAll={() => boardSettings.showAllServices()}
        />
      </Box>
    </SidebarPortal>
  );
}

/** The demo source for `?source=demo`, built once. */
function useDemoSource(enabled: boolean, today: string): PlannerDataSource | null {
  return useMemo(() => (enabled ? new DemoDataSource({ today }) : null), [enabled, today]);
}

export default function PlannerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demo = params.get('source') === 'demo';
  const today = useMemo(() => pragueDateKey(new Date()), []);
  const user = useMemo(() => storedUser(), []);

  /* ---- the mode, from the router state ---- */
  const pick = readPickOrderState(location.state);
  const session: PickSession | null = pick?.start ?? null;
  const needsSetup = pick !== null && session === null;
  const mode: BoardConfig['mode'] = session !== null ? 'club' : 'standard';

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
  const api = useApiDataSource({ session, today });
  const demoSource = useDemoSource(demo, today);
  const source: PlannerDataSource = demoSource ?? api;

  const config = useMemo<BoardConfig>(
    () => ({ realCalendar: true, mode, excludeClubId: session?.clubId ?? null }),
    [mode, session?.clubId],
  );

  return (
    <BoardConfigProvider value={config}>
      <div style={{ height: 'calc(100vh - 32px)', minHeight: 520, width: '100%' }} data-testid="planner-page" data-mode={mode}>
        <PlannerShell
          key={`${source.id}:${session ? `${session.clubId}:${session.editOrder?.orderId ?? 'new'}` : 'standard'}`}
          source={source}
          today={today}
          initialDate={today}
          user={user}
          headerMode={mode === 'club' ? 'club' : 'clinic'}
        />
      </div>
      {mode === 'standard' ? <ServiceLegendPortal /> : null}
      {needsSetup ? <PickOrderSetup open defaultClubId={pick?.clubId} parent={pick?.parent} onClose={closeSetup} onStart={startWith} /> : null}
    </BoardConfigProvider>
  );
}
