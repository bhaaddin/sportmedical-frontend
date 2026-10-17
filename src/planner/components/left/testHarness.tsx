/*
 * Test harness of the left column: the same providers `PlannerShell` builds, but with a store the test can
 * drive (`store.dispatch(plannerActions.…)`), a fixed stage scale and any set of panels.
 */
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DemoDataSource } from '../../data/DemoDataSource';
import { PlannerDataProvider } from '../../data/PlannerDataProvider';
import type { PlannerDataSource } from '../../data/PlannerDataSource';
import type { IsoDate } from '../../model';
import { PlannerStoreProvider, createPlannerStore, type PlannerStore } from '../../state/PlannerStoreProvider';
import { PlannerModelProvider } from '../context';
import { DialogLayer } from '../DialogLayer';
import { PlannerGate } from '../PlannerGate';
import { PlannerStage } from '../PlannerStage';

export const TEST_TODAY: IsoDate = '2026-11-10';

export interface MountOptions {
  source?: PlannerDataSource;
  today?: IsoDate;
  initialDate?: IsoDate;
  /** Wrap in a router (the drawer navigates to the clubs area from a club window). */
  router?: boolean;
  /** Also mount the dialog layer, to see which dialog a click opened. */
  dialogs?: boolean;
}

export interface Mounted extends RenderResult {
  store: PlannerStore;
  source: PlannerDataSource;
}

export function mountPanels(panels: ReactNode, options: MountOptions = {}): Mounted {
  const today = options.today ?? TEST_TODAY;
  const source = options.source ?? new DemoDataSource({ today });
  const store = createPlannerStore({ today, selectedDate: options.initialDate ?? '2026-11-20' });
  const tree = (
    <PlannerDataProvider source={source} today={today}>
      <PlannerStoreProvider initial={{ today, selectedDate: options.initialDate ?? '2026-11-20' }} store={store}>
        <PlannerModelProvider>
          <PlannerStage scale={1}>
            <PlannerGate>
              {panels}
              {options.dialogs ? <DialogLayer /> : null}
            </PlannerGate>
          </PlannerStage>
        </PlannerModelProvider>
      </PlannerStoreProvider>
    </PlannerDataProvider>
  );
  const result = render(options.router ? <MemoryRouter>{tree}</MemoryRouter> : tree);
  return Object.assign(result, { store, source });
}
