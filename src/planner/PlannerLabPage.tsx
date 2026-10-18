/*
 * /planner-lab - the planner for visual comparison with design/planner-v65.html and for the people building the
 * panels. Staff only (it sits behind the sign-in like every other staff page).
 *
 * Two sources, switched by `?source=`:
 *   (default)        in-memory demo data - nothing here touches the API.
 *   ?source=api      OUR system: the application's API clients (`ApiDataSource`). Without more it is the
 *                    standard-booking board of the clinic's calendars; the order being planned comes from
 *                      - the router state `{ pickOrder: { start } }` (as the calendar's pick mode gets it),
 *                      - `?order=<orderId>`                                  the terms of an existing order,
 *                      - `?club=<clubId>&service=<id>&seats=<actId>:<n>,..`  a new order for a club,
 *                    and `?calendars=<id>,<id>` / `?newCalendar=<id>` narrow the calendars.
 *
 * Query parameters (all optional):
 *   ?today=2026-11-10   the clock of the demo (the seven-day release rule depends on it); also the clinic's "today" for api
 *   ?date=2026-11-20    the day the board opens on (demo: the prototype's 2026-11-20, api: today)
 *   ?latency=800        artificial delay of every demo call in ms, to see the loading state (demo only)
 */
import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { pragueDateKey } from '../utils/time';
import { useApiDataSource, useLabOrderSession } from './api/useApiDataSource';
import { PlannerShell } from './components/PlannerShell';
import { useDemoDataSource } from './data/useDemoDataSource';
import { todayIso } from './model';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

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

const frame = { height: 'calc(100vh - 32px)', minHeight: 520, width: '100%' } as const;

function DemoLab({ params }: { params: URLSearchParams }) {
  const todayParam = params.get('today');
  const dateParam = params.get('date');
  const latency = Number(params.get('latency') ?? 0) || 0;
  const today = todayParam && ISO.test(todayParam) ? todayParam : todayIso();
  const initialDate = dateParam && ISO.test(dateParam) ? dateParam : '2026-11-20';
  const source = useDemoDataSource(true, { today, latencyMs: latency });
  const user = useMemo(storedUser, []);
  if (source === null) {
    return (
      <div style={frame} role="status" data-testid="planner-lab-loading">
        Načítám ukázková data…
      </div>
    );
  }
  return (
    <div style={frame} data-testid="planner-lab" data-source="demo">
      <PlannerShell source={source} today={today} initialDate={initialDate} user={user} />
    </div>
  );
}

const list = (raw: string | null): string[] | undefined => {
  const ids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
};

function ApiPlanner({ params, session }: { params: URLSearchParams; session: import('../components/clubs/order/pickSession').PickSession | null }) {
  const todayParam = params.get('today');
  const dateParam = params.get('date');
  const today = todayParam && ISO.test(todayParam) ? todayParam : pragueDateKey(new Date());
  const initialDate = dateParam && ISO.test(dateParam) ? dateParam : today;
  const calendarIds = list(params.get('calendars'));
  const newCalendarIds = list(params.get('newCalendar'));
  const source = useApiDataSource({ session, today, ...(calendarIds ? { calendarIds } : {}), ...(newCalendarIds ? { newCalendarIds } : {}) });
  const user = useMemo(storedUser, []);
  return (
    <div style={frame} data-testid="planner-lab" data-source="api" data-mode={session ? 'club' : 'standard'}>
      <PlannerShell source={source} today={today} initialDate={initialDate} user={user} />
    </div>
  );
}

function ApiLab({ params }: { params: URLSearchParams }) {
  const location = useLocation();
  const todayParam = params.get('today');
  const today = todayParam && ISO.test(todayParam) ? todayParam : pragueDateKey(new Date());
  const state = useLabOrderSession(params, location.state, today, true);
  if (state.status === 'loading') {
    return (
      <div style={frame} role="status" data-testid="planner-lab-loading">
        Načítám objednávku…
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div style={frame} role="alert" data-testid="planner-lab-error">
        {state.message}
      </div>
    );
  }
  return <ApiPlanner params={params} session={state.status === 'ready' ? state.session : null} />;
}

export default function PlannerLabPage() {
  const [params] = useSearchParams();
  return params.get('source') === 'api' ? <ApiLab params={params} /> : <DemoLab params={params} />;
}
