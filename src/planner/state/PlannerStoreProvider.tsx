/*
 * The store behind `plannerReducer`: a tiny external store (so a panel can
 * subscribe to just the slice it needs) exposed through React hooks.
 *
 *   const view = usePlannerSelector((s) => s.view);
 *   const act  = usePlannerActions();        // act.selectDay('2026-11-20')
 *   const dispatch = usePlannerDispatch();   // dispatch(plannerActions.escape())
 *
 * Pure parts live in `plannerState.ts`; this file only wires them to React.
 */
import { createContext, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import {
  createInitialState,
  plannerActions,
  plannerReducer,
  type InitialStateOptions,
  type PlannerAction,
  type PlannerState,
} from './plannerState';

export interface PlannerStore {
  getState(): PlannerState;
  dispatch(action: PlannerAction): void;
  subscribe(listener: () => void): () => void;
}

const isFullState = (v: PlannerState | InitialStateOptions): v is PlannerState => 'view' in v && 'planning' in v;

/** Framework-free store; also what the unit tests drive. */
export function createPlannerStore(initial: PlannerState | InitialStateOptions): PlannerStore {
  let state: PlannerState = isFullState(initial) ? initial : createInitialState(initial);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = plannerReducer(state, action);
      if (next === state) return;
      state = next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const StoreContext = createContext<PlannerStore | null>(null);

export interface PlannerStoreProviderProps {
  /** Initial state, or the options to build it (`{ today, selectedDate }`). */
  initial: PlannerState | InitialStateOptions;
  /** Reuse an existing store (tests). */
  store?: PlannerStore;
  children: ReactNode;
}

export function PlannerStoreProvider({ initial, store, children }: PlannerStoreProviderProps) {
  const ref = useRef<PlannerStore | null>(null);
  if (!ref.current) ref.current = store ?? createPlannerStore(initial);
  return <StoreContext.Provider value={ref.current}>{children}</StoreContext.Provider>;
}

export function usePlannerStore(): PlannerStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('The planner store hooks need a <PlannerStoreProvider>.');
  return store;
}

/** Subscribe to a slice. `equal` keeps object results from re-rendering needlessly. */
export function usePlannerSelector<T>(selector: (state: PlannerState) => T, equal: (a: T, b: T) => boolean = Object.is): T {
  const store = usePlannerStore();
  const cache = useRef<{ state: PlannerState; selector: (s: PlannerState) => T; value: T } | null>(null);
  const getSnapshot = (): T => {
    const state = store.getState();
    const c = cache.current;
    if (c && c.state === state && c.selector === selector) return c.value;
    const value = selector(state);
    if (c && equal(c.value, value)) {
      cache.current = { state, selector, value: c.value };
      return c.value;
    }
    cache.current = { state, selector, value };
    return value;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** The whole state (re-renders on every change; prefer `usePlannerSelector`). */
export const usePlannerState = (): PlannerState => usePlannerSelector((s) => s);

export function usePlannerDispatch(): (action: PlannerAction) => void {
  const store = usePlannerStore();
  return store.dispatch;
}

type Creators = typeof plannerActions;
export type BoundPlannerActions = { [K in keyof Creators]: (...args: Parameters<Creators[K]>) => void };

/** `plannerActions` with `dispatch` applied: `act.nextWeek()`. Stable between renders. */
export function usePlannerActions(): BoundPlannerActions {
  const dispatch = usePlannerDispatch();
  return useMemo(() => {
    const bound = {} as Record<string, (...args: unknown[]) => void>;
    for (const [name, creator] of Object.entries(plannerActions)) {
      bound[name] = (...args: unknown[]) => dispatch((creator as (...a: unknown[]) => PlannerAction)(...args));
    }
    return bound as unknown as BoundPlannerActions;
  }, [dispatch]);
}
