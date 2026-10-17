/*
 * Data + store + model providers in one element, so a panel can be rendered on its own
 * (tests, Storybook-like pages) exactly as `PlannerShell` renders it:
 *
 *   <PlannerProviders source={new DemoDataSource({ today: '2026-11-10' })} today="2026-11-10" initialDate="2026-11-20">
 *     <PlannerStage><PlannerGate><MiniCalendarPanel /></PlannerGate></PlannerStage>
 *   </PlannerProviders>
 */
import { useState, type ReactNode } from 'react';
import { PlannerDataProvider } from '../data/PlannerDataProvider';
import type { PlannerDataSource } from '../data/PlannerDataSource';
import { todayIso, type IsoDate } from '../model';
import { PlannerStoreProvider } from '../state/PlannerStoreProvider';
import { PlannerModelProvider } from './context';

export interface PlannerProvidersProps {
  source: PlannerDataSource;
  /** Today of this session; default the local date. */
  today?: IsoDate;
  /** Day the board opens on; default `today`. The prototype opens on 2026-11-20. */
  initialDate?: IsoDate;
  children: ReactNode;
}

export function PlannerProviders({ source, today, initialDate, children }: PlannerProvidersProps) {
  const [resolvedToday] = useState<IsoDate>(() => today ?? todayIso());
  return (
    <PlannerDataProvider source={source} today={resolvedToday}>
      <PlannerStoreProvider initial={{ today: resolvedToday, selectedDate: initialDate }}>
        <PlannerModelProvider>{children}</PlannerModelProvider>
      </PlannerStoreProvider>
    </PlannerDataProvider>
  );
}
