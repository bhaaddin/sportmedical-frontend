/*
 * How club planning starts and ends - the entry/exit points of the planner for a club order.
 *
 * Today the desk reaches club planning by router state (the same hand-over the calendar's pick mode reads):
 *
 *   toolbar "Klubová objednávka" -> chooser -> "Vyplním sám"      state.pickOrder = { clubId?, parent? }  (needs the small setup form)
 *   club card "Přidat hráče / rozšířit", "Upravit termíny"        state.pickOrder = { start: PickSession } (editSessionFor(...))
 *   club card "Přidat další službu" (an addendum)                 state.pickOrder = { clubId, parent }
 *
 * `useClubPlanningContext()` is the one place that reads it. PL-D's `PlannerPage` asks `mode` to decide between
 * the standard booking planner and club planning, hands `session` to the data source that builds the draft
 * order, mounts `<ClubPlanningEntry />` for the setup form, and calls `end()` when club planning is over.
 *
 * It works without a router too (tests, the lab): then `mode` is 'standard' unless `forced` says otherwise.
 */
import { useCallback, useContext, useMemo, useState } from 'react';
import { UNSAFE_LocationContext, UNSAFE_NavigationContext } from 'react-router-dom';
import { readPickOrderState, type PickParent, type PickSession } from '../../../components/clubs/order/pickSession';

export interface ClubPlanningSetup {
  clubId?: string;
  parent?: PickParent;
}

export interface ClubPlanningContext {
  /** 'club' while a club order is being planned (or about to be: the setup form is open). */
  mode: 'club' | 'standard';
  /** The started session (club, služba, činnosti with players, an edited order's windows), null before setup. */
  session: PickSession | null;
  /** Router asked for club planning without a session: the small setup form must run first. */
  needsSetup: ClubPlanningSetup | null;
  /** The setup form (or anyone) has a session: club planning starts. Survives a reload (router state). */
  start: (session: PickSession) => void;
  /** Club planning is over (finished or cancelled): back to the standard planner. */
  end: () => void;
}

/** Pure part: what router state means. */
export function clubPlanningFromState(state: unknown): Pick<ClubPlanningContext, 'mode' | 'session' | 'needsSetup'> {
  const wanted = readPickOrderState(state);
  if (wanted === null) return { mode: 'standard', session: null, needsSetup: null };
  if (wanted.start !== undefined) return { mode: 'club', session: wanted.start, needsSetup: null };
  return {
    mode: 'club',
    session: null,
    needsSetup: {
      ...(wanted.clubId !== undefined ? { clubId: wanted.clubId } : {}),
      ...(wanted.parent !== undefined ? { parent: wanted.parent } : {}),
    },
  };
}

interface NavigatorLike {
  replace: (to: { pathname: string; search: string; hash: string }, state?: unknown) => void;
}

export function useClubPlanningContext(options: { forced?: PickSession | true } = {}): ClubPlanningContext {
  const locationContext = useContext(UNSAFE_LocationContext) as { location?: { pathname: string; search: string; hash: string; state: unknown } } | null;
  const navigation = useContext(UNSAFE_NavigationContext) as { navigator?: NavigatorLike } | null;
  const location = locationContext?.location ?? null;
  const navigator = navigation?.navigator ?? null;

  /* Outside a router, or when the caller forces it, the context lives in this hook. */
  const [local, setLocal] = useState<PickSession | null>(options.forced !== undefined && options.forced !== true ? options.forced : null);
  const [localEnded, setLocalEnded] = useState(false);

  const fromRouter = useMemo(() => clubPlanningFromState(location?.state ?? null), [location?.state]);

  const start = useCallback(
    (session: PickSession) => {
      if (location !== null && navigator !== null) {
        const rest = { ...(location.state as Record<string, unknown> | null ?? {}) };
        navigator.replace({ pathname: location.pathname, search: location.search, hash: location.hash }, { ...rest, pickOrder: { start: session } });
      }
      setLocalEnded(false);
      setLocal(session);
    },
    [location, navigator],
  );

  const end = useCallback(() => {
    if (location !== null && navigator !== null) {
      const { pickOrder: _drop, ...rest } = (location.state as Record<string, unknown> | null) ?? {};
      navigator.replace({ pathname: location.pathname, search: location.search, hash: location.hash }, rest);
    }
    setLocal(null);
    setLocalEnded(true);
  }, [location, navigator]);

  return useMemo<ClubPlanningContext>(() => {
    if (fromRouter.mode === 'club') return { ...fromRouter, start, end };
    if (!localEnded && (local !== null || options.forced === true)) {
      return { mode: 'club', session: local, needsSetup: local === null ? {} : null, start, end };
    }
    return { mode: 'standard', session: null, needsSetup: null, start, end };
  }, [fromRouter, local, localEnded, options.forced, start, end]);
}
