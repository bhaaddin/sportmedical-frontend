import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../../test/viewport';
import { DemoDataSource } from '../../../data/DemoDataSource';
import type { PlannerCatalogue } from '../../../data/PlannerDataSource';
import { plannerActions } from '../../../state/plannerState';
import { mountPanels } from '../../left/testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

class Priced extends DemoDataSource {
  async getCatalogue(): Promise<PlannerCatalogue> {
    const c = await super.getCatalogue();
    return { ...c, categories: c.categories.map((x) => ({ ...x, priceCzk: x.id === 'medical' ? 1600 : null })) };
  }
}

describe('filterPicker: a činnost is listed with its price', () => {
  it('shows "name · price" per entry, "bez ceny" without a price, and still filters by the činnost id', async () => {
    const { store } = mountPanels(null, { source: new Priced({ today: '2026-11-10' }), dialogs: true });
    act(() => store.dispatch(plannerActions.openDialog({ kind: 'filterPicker' })));
    const select = (await screen.findByLabelText('Zobrazit činnosti')) as HTMLSelectElement;
    const options = [...select.options].map((o) => [o.value, o.textContent] as const);
    expect(options[0]).toEqual(['all', 'Všechny činnosti']);
    const medical = options.find(([v]) => v === 'medical')!;
    expect(medical[1]).toMatch(/^Sportovní prohlídky · 1\s600\sKč$/);
    expect(options.filter(([v]) => v !== 'all' && v !== 'medical').every(([, t]) => /· bez ceny$/.test(t ?? ''))).toBe(true);
    fireEvent.change(select, { target: { value: 'medical' } });
    fireEvent.click(screen.getByRole('button', { name: 'Použít filtr' }));
    expect(store.getState().filter).toBe('medical');
  });
});
