/*
 * Gives the planner UI its `PlannerDataSource`.
 *
 *   <PlannerDataProvider source={new DemoDataSource()}>…</PlannerDataProvider>
 *
 * - Uses the application's QueryClient when there is one, otherwise creates a
 *   private one (so the planner also works in an isolated test).
 * - Subscribes to the source and invalidates every planner query when it
 *   announces a change.
 * - `usePlannerData()` returns the source, `today` and the shared helpers.
 */
import { QueryClient, QueryClientContext, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todayIso, type IsoDate } from '../model';
import { plannerKeys, type PlannerDataSource } from './PlannerDataSource';

export interface PlannerDataContextValue {
  source: PlannerDataSource;
  /** "Today" of this planner session (injectable for tests). */
  today: IsoDate;
}

const PlannerDataContext = createContext<PlannerDataContextValue | null>(null);

function createPrivateClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}

function Subscriber({ source, children }: { source: PlannerDataSource; children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => {
    if (!source.subscribe) return undefined;
    return source.subscribe(() => {
      void client.invalidateQueries({ queryKey: plannerKeys.all(source.id) });
    });
  }, [client, source]);
  return <>{children}</>;
}

export interface PlannerDataProviderProps {
  source: PlannerDataSource;
  /** Defaults to the local date at mount. */
  today?: IsoDate;
  children: ReactNode;
}

export function PlannerDataProvider({ source, today, children }: PlannerDataProviderProps) {
  const outer = useContext(QueryClientContext);
  const [own] = useState<QueryClient | null>(() => (outer ? null : createPrivateClient()));
  const value = useMemo<PlannerDataContextValue>(() => ({ source, today: today ?? todayIso() }), [source, today]);
  const inner = (
    <PlannerDataContext.Provider value={value}>
      <Subscriber source={source}>{children}</Subscriber>
    </PlannerDataContext.Provider>
  );
  return own ? <QueryClientProvider client={own}>{inner}</QueryClientProvider> : inner;
}

/** The source and "today". Throws outside a `PlannerDataProvider`. */
export function usePlannerData(): PlannerDataContextValue {
  const value = useContext(PlannerDataContext);
  if (!value) throw new Error('usePlannerData() needs a <PlannerDataProvider>.');
  return value;
}
