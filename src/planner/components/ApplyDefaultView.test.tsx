/*
 * "Výchozí pohled": the calendar opens in the view the clinic chose (settings audit O1: it was stored and read back,
 * and nothing used it). Applied once, never over a view the person already picked.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createPlannerStore, PlannerStoreProvider } from '../state/PlannerStoreProvider';
import type { PlannerView } from '../state/plannerState';
import { ApplyDefaultView } from './ApplyDefaultView';

const mount = (view: PlannerView | undefined, preset?: PlannerView) => {
  const store = createPlannerStore({ today: '2026-10-20' });
  if (preset) store.dispatch({ type: 'setView', view: preset });
  const ui = (v: PlannerView | undefined) => (
    <PlannerStoreProvider initial={{ today: '2026-10-20' }} store={store}>
      <ApplyDefaultView view={v} />
    </PlannerStoreProvider>
  );
  const r = render(ui(view));
  return { store, rerender: (v: PlannerView | undefined) => r.rerender(ui(v)) };
};

describe('ApplyDefaultView', () => {
  it('the planner opens on the week (the prototype)', () => {
    expect(createPlannerStore({ today: '2026-10-20' }).getState().view).toBe('week');
  });

  it.each(['day', 'month'] as const)('opens on %s when that is the clinic\'s default', (view) => {
    const { store } = mount(view);
    expect(store.getState().view).toBe(view);
  });

  it('leaves the week alone when the default is the week', () => {
    expect(mount('week').store.getState().view).toBe('week');
  });

  it('does nothing while the setting has not arrived (undefined), then applies it when it does', () => {
    const { store, rerender } = mount(undefined);
    expect(store.getState().view).toBe('week');
    rerender('day');
    expect(store.getState().view).toBe('day');
  });

  it.each(['day', 'month'] as const)('does not move somebody who is already on %s', (preset) => {
    const other: PlannerView = preset === 'day' ? 'month' : 'day';
    const { store } = mount(other, preset);
    expect(store.getState().view).toBe(preset);
  });

  it('applies only once: after the person changes the view the default does not pull it back', () => {
    const { store, rerender } = mount('month');
    expect(store.getState().view).toBe('month');
    act(() => store.dispatch({ type: 'setView', view: 'week' }));
    rerender('month');
    expect(store.getState().view).toBe('week');
    rerender('day');
    expect(store.getState().view).toBe('week');
  });

  it('renders nothing', () => {
    const store = createPlannerStore({ today: '2026-10-20' });
    const { container } = render(
      <PlannerStoreProvider initial={{ today: '2026-10-20' }} store={store}>
        <ApplyDefaultView view="day" />
      </PlannerStoreProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
