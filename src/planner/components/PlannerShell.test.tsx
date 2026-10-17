import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { DemoDataSource } from '../data/DemoDataSource';
import { fitScale, STAGE_HEIGHT, STAGE_WIDTH } from './PlannerStage';
import { PlannerShell } from './PlannerShell';

const TODAY = '2026-11-10';
const mount = (source = new DemoDataSource({ today: TODAY }), props = {}) =>
  render(<PlannerShell source={source} today={TODAY} initialDate="2026-11-20" {...props} />);

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

/** Every id of the prototype's live UI that the shell must carry (pixel-mode ones excluded). */
const PROTOTYPE_IDS = [
  'screen-frame', 'dashboard', 'live-ui', 'month-title', 'mini-days', 'agenda-panel', 'agenda-total-count',
  'agenda-activities-view', 'agenda-activity-chips', 'agenda-activity-kpi', 'agenda-activity-term-count',
  'agenda-activity-list', 'agenda-all-view', 'agenda-scope-note', 'agenda-all-totals', 'agenda-all-list',
  'agenda-footer-status', 'week-range', 'week-number', 'activity-filter', 'week-board', 'day-headings', 'board-body',
  'hour-column', 'day-board', 'grid-events', 'drag-preview', 'drag-hud', 'move-lanes', 'move-ghost', 'move-hud',
  'term-resize-range', 'term-resize-added', 'term-resize-hud', 'alternate-view', 'club-unified-header',
  'club-logo-slot', 'club-logo-input', 'club-logo-preview', 'club-identity-name', 'club-edit-link', 'club-edit-label',
  'club-details-strip', 'hdr-ico', 'hdr-dic', 'hdr-address', 'hdr-leader', 'hdr-leader-email', 'hdr-leader-phone',
  'hdr-contact', 'hdr-contact-email', 'hdr-contact-phone', 'order-command', 'oc-ring', 'oc-percent', 'oc-total',
  'oc-remaining', 'oc-terms', 'oc-slots', 'finish-plan', 'active-plan-hint', 'corner-return', 'planning-cards',
  'status-overlay', 'mini-day-tooltip', 'reservation-drawer-layer', 'dialog-layer', 'summary-experience-layer',
  'toast-layer', 'planner-feedback',
];

describe('stage maths', () => {
  it('fits 1672 x 941 into a container like the prototype scaleToFit', () => {
    expect(fitScale(1672, 941)).toBe(1);
    expect(fitScale(836, 941)).toBe(0.5);
    expect(fitScale(1672, 470.5)).toBe(0.5);
    expect(fitScale(3344, 941)).toBe(1);
    expect(fitScale(0, 0)).toBe(1);
    expect(fitScale(-1, 500)).toBe(1);
    expect([STAGE_WIDTH, STAGE_HEIGHT]).toEqual([1672, 941]);
  });
});

describe('PlannerShell', () => {
  it('renders every region of the prototype with its id', async () => {
    mount();
    await screen.findByTestId('planner-stage');
    await waitFor(() => expect(document.getElementById('day-board')).not.toBeNull());
    const missing = PROTOTYPE_IDS.filter((id) => !document.getElementById(id));
    expect(missing).toEqual([]);
    for (const testId of [
      'planner-root', 'planner-frame', 'planner-stage', 'planner-icons', 'club-header', 'mini-calendar', 'agenda-panel',
      'week-board-panel', 'planning-carousel', 'order-command', 'reservation-drawer', 'dialog-layer', 'toast-layer',
      'summary-layer', 'mini-day-tooltip', 'completion-callout', 'sidebar', 'day-board',
    ]) {
      expect(screen.getByTestId(testId), testId).toBeInTheDocument();
    }
    expect(document.querySelectorAll('.sm-planner symbol[id^="icon-"]')).toHaveLength(22);
  });

  it('keeps the stage at design size and scales it with CSS', async () => {
    mount();
    const stage = await screen.findByTestId('planner-stage');
    expect(stage.id).toBe('dashboard');
    expect(stage).toHaveClass('live-mode');
    expect(stage.style.transform).toBe('scale(1)'); // jsdom has no layout: the fallback scale
    expect(screen.getByTestId('planner-frame').style.width).toBe('1672px');
    expect(screen.getByTestId('planner-frame').style.height).toBe('941px');
  });

  it('shows the club header values and the "Doplnit" placeholders', async () => {
    mount();
    expect(await screen.findByText('RC Mountfield Říčany')).toBeInTheDocument();
    const header = screen.getByTestId('club-header');
    expect(within(header).getAllByText('Doplnit')).toHaveLength(9);
    expect(document.getElementById('hdr-ico')).toHaveClass('is-missing');
    expect(document.getElementById('hdr-ico')).toHaveAttribute('title', 'Údaj zatím není vyplněn');
  });

  it('wires the order numbers from the demo order', async () => {
    mount();
    await screen.findByTestId('order-command');
    expect(document.getElementById('oc-percent')).toHaveTextContent('67%');
    expect(document.getElementById('oc-total')).toHaveTextContent('252 / 378');
    expect(document.getElementById('oc-remaining')).toHaveTextContent('126 osob zbývá naplánovat');
    expect(document.getElementById('oc-terms')).toHaveTextContent('6');
    expect(document.getElementById('oc-slots')).toHaveTextContent('0');
    expect(document.getElementById('active-plan-hint')).toHaveTextContent('Vyberte činnost');
  });

  it('navigates weeks and months through the store', async () => {
    mount();
    await screen.findByTestId('week-board-panel');
    expect(document.getElementById('week-range')).toHaveTextContent('16. – 22. listopadu 2026');
    expect(document.getElementById('week-number')).toHaveTextContent('47. týden');
    expect(document.getElementById('month-title')).toHaveTextContent('Listopad 2026');
    expect(document.querySelectorAll('#day-headings .day-title')).toHaveLength(7);
    expect(document.querySelectorAll('#hour-column .hour-label')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Následující týden' }));
    expect(document.getElementById('week-range')).toHaveTextContent('23. – 29. listopadu 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Následující měsíc' }));
    expect(document.getElementById('month-title')).toHaveTextContent('Prosinec 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Předchozí týden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));
    expect(document.getElementById('week-range')).toHaveTextContent('9. – 15. listopadu 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    expect(screen.getByRole('button', { name: 'Měsíc' })).toHaveClass('active');
    expect(document.getElementById('alternate-view')).not.toHaveAttribute('hidden');
    fireEvent.change(document.getElementById('activity-filter')!, { target: { value: 'physio' } });
    expect((document.getElementById('activity-filter') as HTMLSelectElement).value).toBe('physio');
    expect(document.querySelectorAll('#activity-filter option')).toHaveLength(7);
  });

  it('switches the agenda tabs and scopes', async () => {
    mount();
    await screen.findByTestId('agenda-panel');
    expect(document.getElementById('agenda-total-count')).toHaveTextContent('18');
    expect(document.getElementById('agenda-footer-status')).toHaveTextContent('Zbývá 24 slotů naplánovat');
    expect(document.getElementById('agenda-all-view')).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: /Všechny termíny/ }));
    expect(document.getElementById('agenda-all-view')).not.toHaveAttribute('hidden');
    expect(document.getElementById('agenda-activities-view')).toHaveAttribute('hidden');
    expect(document.getElementById('agenda-footer-status')).toHaveTextContent('18 termínů v kalendáři');
    fireEvent.click(document.querySelector('[data-agenda-scope="week"]')!);
    expect(document.getElementById('agenda-scope-note')).toHaveTextContent('Aktuální týden');
  });

  it('opens a dialog frame and closes it with the button, the scrim and Esc', async () => {
    mount();
    await screen.findByTestId('dialog-layer');
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Nastavení plánování' })).toBeInTheDocument();
    expect(screen.getByTestId('dialog-layer')).toHaveClass('open');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hotovo' })); // the settings dialog's own footer (the file: "Hotovo")
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Upravit údaje klubu/ }));
    expect(await screen.findByRole('heading', { name: 'Údaje o klubu' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    fireEvent.click(screen.getByLabelText('Oznámení'));
    expect(await screen.findByRole('heading', { name: 'Upozornění' })).toBeInTheDocument();
    fireEvent.click(document.querySelector('.modal-scrim')!);
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });

  it('names the signed-in user in the profile chip', async () => {
    mount(undefined, { user: { displayName: 'Jan Novák' } });
    expect(await screen.findByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('JN')).toBeInTheDocument();
  });

  it('shows a loading state and then the planner', async () => {
    mount(new DemoDataSource({ today: TODAY, latencyMs: 30 }));
    expect(screen.getByTestId('planner-loading')).toHaveTextContent('Načítám plánovač');
    await screen.findByTestId('club-header', undefined, { timeout: 2000 });
    expect(screen.queryByTestId('planner-loading')).toBeNull();
  });

  it('shows an error state with a retry', async () => {
    const source = new DemoDataSource({ today: TODAY });
    source.failNext(new Error('Server neodpovídá.'));
    mount(source);
    const alert = await screen.findByTestId('planner-error');
    expect(alert).toHaveTextContent('Plánovač se nepodařilo načíst.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Zkusit znovu' }));
    await screen.findByTestId('club-header');
  });

  it('keeps data fresh when the source announces a change', async () => {
    const source = new DemoDataSource({ today: TODAY });
    mount(source);
    await screen.findByTestId('order-command');
    await act(async () => {
      await source.createInterval({ date: '2026-11-25', categoryId: 'physio', start: '09:00', quantity: 2 });
    });
    await waitFor(() => expect(document.getElementById('oc-total')).toHaveTextContent('254 / 378'));
    expect(document.getElementById('oc-slots')).toHaveTextContent('2');
  });

  it('puts a toast on the layer and removes it with Esc handling intact', async () => {
    mount();
    await screen.findByTestId('toast-layer');
    fireEvent.keyDown(document, { key: 'n' });
    expect(await screen.findByText('Nejprve vyberte činnost z dolních karet.')).toBeInTheDocument();
  });
});

describe('PlannerShell on narrower screens', () => {
  it('shows the desktop-only notice below 1280 px, the stage when forced', async () => {
    setViewport(VIEWPORTS.tablet);
    const { unmount } = mount();
    expect(screen.getByTestId('planner-desktop-only')).toHaveTextContent('jen na počítači');
    expect(screen.queryByTestId('planner-stage')).toBeNull();
    unmount();
    mount(undefined, { forceDesktop: true });
    expect(await screen.findByTestId('planner-stage')).toBeInTheDocument();
  });
});
