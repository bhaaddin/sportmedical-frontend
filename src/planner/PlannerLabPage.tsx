/*
 * /planner-lab - the planner on in-memory demo data, for visual comparison with
 * design/planner-v65.html and for the people building the panels. Staff only (it sits behind the
 * sign-in like every other staff page). Nothing here touches the API.
 *
 * Query parameters (all optional):
 *   ?today=2026-11-10   the clock of the demo (the seven-day release rule depends on it)
 *   ?date=2026-11-20    the day the board opens on (default: the prototype's 2026-11-20)
 *   ?latency=800        artificial delay of every demo call in ms, to see the loading state
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DemoDataSource } from './data/DemoDataSource';
import { PlannerShell } from './components/PlannerShell';
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

export default function PlannerLabPage() {
  const [params] = useSearchParams();
  const todayParam = params.get('today');
  const dateParam = params.get('date');
  const latency = Number(params.get('latency') ?? 0) || 0;
  const today = todayParam && ISO.test(todayParam) ? todayParam : todayIso();
  const initialDate = dateParam && ISO.test(dateParam) ? dateParam : '2026-11-20';
  const source = useMemo(() => new DemoDataSource({ today, latencyMs: latency }), [today, latency]);
  const user = useMemo(storedUser, []);
  return (
    <div style={{ height: 'calc(100vh - 32px)', minHeight: 520, width: '100%' }} data-testid="planner-lab">
      <PlannerShell source={source} today={today} initialDate={initialDate} user={user} />
    </div>
  );
}
