import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { DemoDataSource } from '../../data/DemoDataSource';
import type { PlannerCatalogue } from '../../data/PlannerDataSource';
import { plannerActions } from '../../state/plannerState';
import { AgendaPanel } from '../AgendaPanel';
import { mountPanels } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

const text = (id: string) => document.getElementById(id)!;

/** R3: the standard sidebar is the činnosti list alone. */
function expectNoAllTermsTab() {
  expect(screen.queryByRole('button', { name: /Všechny termíny/ })).toBeNull();
  for (const id of ['agenda-all-view', 'agenda-all-list', 'agenda-all-totals', 'agenda-scope-note', 'agenda-total-count', 'agenda-footer-status']) expect(document.getElementById(id)).toBeNull();
  expect(document.querySelector('[data-agenda-scope], [data-agenda-full], [data-agenda-mode]')).toBeNull();
  expect(screen.queryByText(/Kompletní seznam/)).toBeNull();
  expect(text('agenda-activities-view')).not.toHaveAttribute('hidden');
}

describe('AgendaPanel while planning a club order', () => {
  it('shows the ordered činnosti as chips and the selected one with planned / ordered seats', async () => {
    mountPanels(<AgendaPanel />);
    await screen.findByTestId('agenda-panel');
    const chips = [...document.querySelectorAll('#agenda-activity-chips .agenda-chip')].map((c) => c.textContent);
    expect(chips).toEqual(['Prohlídky', 'Pohyb', 'Kondice', 'Fyzio', 'VO₂max', 'Výkon']);
    expect(document.querySelector('.agenda-chip.is-active')).toHaveTextContent('Prohlídky');
    const kpi = text('agenda-activity-kpi');
    expect(kpi).toHaveTextContent('Sportovní prohlídky');
    expect(kpi.querySelector('.agenda-kpi-numbers')).toHaveTextContent('48 / 72 slotů');
    expect(kpi.querySelector('.agenda-track span')).toHaveStyle('--fill: 66.66666666666666%');
    expect(kpi.querySelector('.agenda-kpi-bottom')).toHaveTextContent('7 vytvořených termínů');
    expect(kpi.querySelector('.agenda-remaining')).toHaveTextContent('zbývá 24 slotů');
    expect(text('agenda-activity-term-count')).toHaveTextContent('7 termínů');
    const rows = within(text('agenda-activity-list')).getAllByTestId('agenda-term');
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent('16. 11.');
    expect(rows[0]).toHaveTextContent('07:00–08:00');
    expect(rows[0]).toHaveTextContent('3sloty');
    expect(rows[1]).toHaveTextContent('08:50–12:30');
    expect(text('agenda-footer-status')).toHaveTextContent('Zbývá 24 slotů naplánovat');
    expect(text('agenda-total-count')).toHaveTextContent('18');
    expect([...document.querySelectorAll('.agenda-mode-tabs button')][0]).toHaveTextContent('Plánované činnosti');
  });

  it('switches the činnost with the chips and marks a finished one', async () => {
    const { store } = mountPanels(<AgendaPanel />);
    await screen.findByTestId('agenda-panel');
    fireEvent.click(document.querySelector('[data-agenda-type="physio"]')!);
    expect(store.getState().agenda.categoryId).toBe('physio');
    expect(text('agenda-activity-kpi')).toHaveTextContent('Fyzioterapie');
    expect(text('agenda-activity-kpi').querySelector('.agenda-kpi-numbers')).toHaveTextContent('16 / 24 slotů');
    expect(text('agenda-footer-status')).toHaveTextContent('Zbývá 8 slotů naplánovat');
    expect(within(text('agenda-activity-list')).getAllByTestId('agenda-term')).toHaveLength(1);
    fireEvent.click(document.querySelector('[data-agenda-type="performance"]')!);
    expect(within(text('agenda-activity-list')).getAllByTestId('agenda-term')).toHaveLength(2);
    expect(text('agenda-activity-kpi').querySelector('.agenda-kpi-numbers')).toHaveTextContent('62 / 112 slotů');
  });

  it('lists every term of the order under "Všechny termíny" and narrows them by day and week', async () => {
    const { store } = mountPanels(<AgendaPanel />);
    await screen.findByTestId('agenda-panel');
    fireEvent.click(screen.getByRole('button', { name: /Všechny termíny/ }));
    expect(text('agenda-all-view')).not.toHaveAttribute('hidden');
    expect(text('agenda-activities-view')).toHaveAttribute('hidden');
    expect(text('agenda-all-totals')).toHaveTextContent('18 vytvořených termínů');
    expect(within(text('agenda-all-list')).getAllByTestId('agenda-term')).toHaveLength(18);
    expect(text('agenda-footer-status')).toHaveTextContent('18 termínů v kalendáři');
    expect(text('agenda-scope-note')).toHaveTextContent('Chronologický přehled');

    // the board shows 16.-22. 11. (the selected day is Friday 20. 11.)
    fireEvent.click(document.querySelector('[data-agenda-scope="week"]')!);
    expect(text('agenda-scope-note')).toHaveTextContent('Aktuální týden');
    const week = within(text('agenda-all-list')).getAllByTestId('agenda-term');
    expect(week.length).toBe(13);
    expect(text('agenda-all-totals')).toHaveTextContent('13 vytvořených termínů');

    fireEvent.click(document.querySelector('[data-agenda-scope="day"]')!);
    expect(text('agenda-scope-note')).toHaveTextContent('Datum 20. 11.');
    expect(within(text('agenda-all-list')).getAllByTestId('agenda-term')).toHaveLength(2);
    expect(text('agenda-all-totals')).toHaveTextContent('2 vytvořené termíny');
    expect(text('agenda-all-totals')).toHaveTextContent('20 slotů celkem');

    act(() => store.dispatch(plannerActions.selectDay('2026-11-12')));
    expect(text('agenda-all-list')).toHaveTextContent('V tomto období nejsou vytvořené termíny.');
  });

  it('opens a term (detail dialog) and brings the board to its week; the footer opens the full list', async () => {
    const { store } = mountPanels(<AgendaPanel />);
    await screen.findByTestId('agenda-panel');
    fireEvent.click(document.querySelector('[data-agenda-type="vo2"]')!);
    fireEvent.click(within(text('agenda-activity-list')).getAllByTestId('agenda-term')[0]!);
    expect(store.getState().dialog).toEqual({ kind: 'agendaDetail', id: 'samplePublic06' });
    expect(store.getState().selectedDate).toBe('2026-11-06');
    expect(store.getState().weekStart).toBe('2026-11-02');
    fireEvent.click(screen.getByRole('button', { name: /Kompletní seznam/ }));
    expect(store.getState().dialog).toEqual({ kind: 'agendaFullList', categoryId: 'vo2' });
    fireEvent.click(screen.getByRole('button', { name: /Všechny termíny/ }));
    fireEvent.click(screen.getByRole('button', { name: /Kompletní seznam/ }));
    expect(store.getState().dialog).toEqual({ kind: 'agendaFullList', categoryId: 'all' });
  });

  it('follows a term created in the planner', async () => {
    const source = new DemoDataSource({ today: '2026-11-10' });
    mountPanels(<AgendaPanel />, { source });
    await screen.findByTestId('agenda-panel');
    await act(async () => {
      await source.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '09:00', quantity: 2 });
    });
    await waitFor(() => expect(text('agenda-footer-status')).toHaveTextContent('Zbývá 22 slotů naplánovat'));
    expect(text('agenda-total-count')).toHaveTextContent('19');
    expect(text('agenda-activity-term-count')).toHaveTextContent('8 termínů');
  });
});

describe('AgendaPanel in standard booking (no club order)', () => {
  const standardSource = () => {
    const source = new DemoDataSource({ today: '2026-11-10' });
    const order = source.getOrder.bind(source);
    source.getOrder = async () => ({ ...(await order()), demands: [], baselineSessions: [] });
    return source;
  };

  it('lists the činnosti that have a session, with their slots instead of ordered seats', async () => {
    mountPanels(<AgendaPanel />, { source: standardSource() });
    await screen.findByTestId('agenda-panel');
    expect(text('agenda-panel')).toHaveAttribute('data-agenda-standard', 'true');
    const chips = [...document.querySelectorAll('#agenda-activity-chips .agenda-chip')].map((c) => c.textContent);
    expect(chips).toEqual(['Prohlídky', 'VO₂max', 'Pohyb', 'Kondice', 'Fyzio', 'Výkon']);
    const kpi = text('agenda-activity-kpi');
    expect(kpi.querySelector('.agenda-kpi-numbers')).toHaveTextContent(/^\d+ slotů$/);
    expect(kpi.querySelector('.agenda-kpi-numbers')).not.toHaveTextContent('/');
    expect(kpi.querySelector('.agenda-remaining')).toHaveTextContent('% všech slotů');
    // R3: nothing of the "Všechny termíny" tab is left - no tab, list, scopes, counter or footer
    expectNoAllTermsTab();
  });

  it("speaks the clinic's words, not the club order's: one heading \"Činnosti\", no tabs (R3)", async () => {
    mountPanels(<AgendaPanel />, { source: standardSource() });
    await screen.findByTestId('agenda-panel');
    expect(screen.getByTestId('agenda-title')).toHaveTextContent('Činnosti');
    expect(document.querySelectorAll('.agenda-mode-tabs button')).toHaveLength(0);
    expect(screen.getByTestId('agenda-panel')).toHaveAttribute('aria-label', 'Přehled termínů');
    expect(document.querySelector('.agenda-section-caption span')).toHaveTextContent('TERMÍNY ČINNOSTI V KALENDÁŘI');
    expect(screen.getByTestId('agenda-panel').textContent).not.toMatch(/Plánované|vytvořen/);
  });

  it('says so when the clinic has no session at all', async () => {
    const source = new DemoDataSource({ today: '2026-11-10', sessions: [] });
    const order = source.getOrder.bind(source);
    source.getOrder = async () => ({ ...(await order()), demands: [], baselineSessions: [] });
    mountPanels(<AgendaPanel />, { source });
    await screen.findByTestId('agenda-panel');
    expect(document.querySelectorAll('#agenda-activity-chips .agenda-chip')).toHaveLength(0);
    expect(text('agenda-activity-list')).toHaveTextContent('Pro tuto činnost zatím nejsou v kalendáři žádné termíny.');
  });
});

describe('AgendaPanel and other clubs\' windows', () => {
  const sessions = [
    { id: 'mine', date: '2026-11-18', start: '08:00', end: '10:00', categoryId: 'medical', capacity: 6, booked: 0, origin: 'club' as const, showInList: true },
    { id: 'theirs', date: '2026-11-18', start: '10:00', end: '12:00', categoryId: 'medical', capacity: 6, booked: 0, origin: 'public' as const, showInList: true, foreign: true, clubName: 'FK Slaný' },
    { id: 'nameless', date: '2026-11-19', start: '10:00', end: '12:00', categoryId: '', capacity: 0, booked: 0, origin: 'club' as const, showInList: true, foreign: true, clubName: 'SK Říčany' },
  ];

  it('does not list another club\'s window among the terms of the order being planned', async () => {
    mountPanels(<AgendaPanel />, { source: new DemoDataSource({ today: '2026-11-10', sessions }) });
    await screen.findByTestId('agenda-panel');
    expect(text('agenda-total-count')).toHaveTextContent('1');
    expect(within(text('agenda-activity-list')).getAllByTestId('agenda-term')).toHaveLength(1);
  });

  it('lists a window with a činnost in standard booking, and leaves out one without', async () => {
    const source = new DemoDataSource({ today: '2026-11-10', sessions });
    const order = source.getOrder.bind(source);
    source.getOrder = async () => ({ ...(await order()), demands: [], baselineSessions: [] });
    mountPanels(<AgendaPanel />, { source });
    await screen.findByTestId('agenda-panel');
    expect(document.querySelectorAll('#agenda-activity-chips .agenda-chip')).toHaveLength(1);
  });
});

describe('AgendaPanel prices (the owner rule - a činnost never stands without its price)', () => {
  /** Standard booking over a price list: Prohlídky 1 600 Kč, Pohyb without a price, the rest as the demo has it. */
  class Priced extends DemoDataSource {
    async getCatalogue(): Promise<PlannerCatalogue> {
      const c = await super.getCatalogue();
      return {
        ...c,
        categories: c.categories.map((x) => (x.id === 'medical' ? { ...x, priceCzk: 1600 } : x.id === 'vo2' ? { ...x, priceCzk: 2400 } : { ...x, priceCzk: null })),
      };
    }
  }
  const pricedSource = (standard: boolean) => {
    const source = new Priced({ today: '2026-11-10' });
    if (standard) {
      const order = source.getOrder.bind(source);
      source.getOrder = async () => ({ ...(await order()), demands: [], baselineSessions: [] });
    }
    return source;
  };

  it('writes the price on the činnost card and on every chip (tooltip and name), "bez ceny" without one', async () => {
    mountPanels(<AgendaPanel />, { source: pricedSource(true) });
    await screen.findByTestId('agenda-panel');
    expect(screen.getByTestId('agenda-kpi-price').textContent).toMatch(/^cena 1\s600\sKč$/);
    const chip = (id: string) => document.querySelector(`[data-agenda-type="${id}"]`)!;
    expect(chip('medical').getAttribute('title')).toMatch(/^Sportovní prohlídky · 1\s600\sKč$/);
    expect(chip('medical').getAttribute('aria-label')).toBe(chip('medical').getAttribute('title'));
    expect(chip('vo2').getAttribute('title')).toMatch(/· 2\s400\sKč$/);
    expect(chip('movement').getAttribute('title')).toMatch(/· bez ceny$/);
    fireEvent.click(chip('movement'));
    expect(screen.getByTestId('agenda-kpi-price')).toHaveTextContent('bez ceny');
    fireEvent.click(chip('vo2'));
    expect(screen.getByTestId('agenda-kpi-price').textContent).toMatch(/2\s400\sKč$/);
  });

  it('leaves the club order card as it is (the order shows its own prices)', async () => {
    mountPanels(<AgendaPanel />, { source: pricedSource(false) });
    await screen.findByTestId('agenda-panel');
    expect(screen.queryByTestId('agenda-kpi-price')).toBeNull();
    expect(document.querySelector('[data-agenda-type="medical"]')!.hasAttribute('title')).toBe(false);
  });
});

describe('R20: the MAIN calendar has no agenda under the mini calendar; a club screen keeps its panel', () => {
  const withMode = (mode: 'standard' | 'club') => {
    class Moded extends DemoDataSource {
      async getCatalogue(): Promise<PlannerCatalogue> {
        const c = await super.getCatalogue();
        return { ...c, capabilities: { ...c.capabilities, mode } };
      }
    }
    return new Moded({ today: '2026-11-10' });
  };

  it('the standard (main) calendar draws no agenda panel at all - no pills, card or term list', async () => {
    mountPanels(<div data-testid="host"><AgendaPanel /></div>, { source: withMode('standard') });
    await screen.findByTestId('host');
    expect(screen.queryByTestId('agenda-panel')).toBeNull();
    expect(document.getElementById('agenda-activity-chips')).toBeNull();
    expect(document.getElementById('agenda-activity-kpi')).toBeNull();
    expect(document.getElementById('agenda-activity-list')).toBeNull();
    expect(screen.queryByText(/TERMÍNY ČINNOSTI V KALENDÁŘI/)).toBeNull();
  });

  it("a club's order screen keeps the panel exactly as it was", async () => {
    mountPanels(<AgendaPanel />, { source: withMode('club') });
    await screen.findByTestId('agenda-panel');
    expect(document.querySelectorAll('#agenda-activity-chips .agenda-chip').length).toBeGreaterThan(0);
    expect(text('agenda-activity-kpi')).toHaveTextContent('Sportovní prohlídky');
  });
});
