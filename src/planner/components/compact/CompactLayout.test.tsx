/*
 * The tablet / phone layouts (390 / 834 / 1024 px): the same panels, reflowed. jsdom has no layout engine, so what is
 * checked here is structure and behaviour - which layout is drawn, drawer / sheet open and close with focus, the
 * expander, the order bar, one-day vs week, club planning by two taps. The geometry (no horizontal overflow, 44 px
 * targets) is measured in a real Chromium by `scripts/planner-compact-audit.mjs`.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '../../../test/viewport';
import { DemoDataSource } from '../../data/DemoDataSource';
import { PlannerShell } from '../PlannerShell';
import { at, giveBoardGeometry, ownerSource, TODAY, WEEK_DATE } from '../plan/testHarness';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const IDS = [
  'dashboard', 'live-ui', 'month-title', 'mini-days', 'agenda-panel', 'week-board', 'day-headings', 'board-body', 'hour-column',
  'day-board', 'grid-events', 'drag-preview', 'alternate-view', 'club-unified-header', 'club-details-strip', 'hdr-ico', 'hdr-contact-phone',
  'order-command', 'finish-plan', 'active-plan-hint', 'planning-cards', 'mini-day-tooltip', 'reservation-drawer-layer', 'dialog-layer',
  'summary-experience-layer', 'toast-layer', 'planner-feedback',
];

function mount(width: number, source: DemoDataSource = new DemoDataSource({ today: TODAY }), props: Record<string, unknown> = {}) {
  setViewport(width, 900);
  return render(
    <MemoryRouter>
      <PlannerShell source={source} today={TODAY} initialDate={WEEK_DATE} {...props} />
    </MemoryRouter>,
  );
}
const ready = async () => {
  await screen.findByTestId('planner-stage');
  await waitFor(() => expect(document.getElementById('day-board')).not.toBeNull());
};

describe.each([
  ['phone', 390],
  ['tablet', 834],
] as const)('%s layout', (layout, width) => {
  it('draws every region of the file, no design stage, the order bar and the deck', async () => {
    mount(width);
    await ready();
    expect(screen.getByTestId('planner-root')).toHaveAttribute('data-layout', layout);
    expect(screen.getByTestId('planner-root')).toHaveClass('is-compact');
    expect(screen.getByTestId('planner-stage').style.transform).toBe('');
    expect(screen.getByTestId('planner-frame').style.width).toBe('');
    expect(IDS.filter((id) => !document.getElementById(id))).toEqual([]);
    const dock = screen.getByTestId('compact-dock');
    const bar = within(document.getElementById('order-command')!);
    expect(dock).toContainElement(document.getElementById('order-command'));
    expect(bar.getByText('Zpět')).toBeInTheDocument();
    expect(bar.getByText('Připravit formulář')).toBeInTheDocument();
    expect(within(dock).getByTestId('compact-summary-button')).toBeInTheDocument();
    expect(screen.getByTestId('planning-carousel')).toBeInTheDocument();
  });

  it('collapses the header behind an expander', async () => {
    mount(width);
    await ready();
    const header = screen.getByTestId('compact-header');
    const toggle = screen.getByTestId('compact-header-toggle');
    expect(header).toHaveAttribute('data-open', 'false');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'club-details-strip');
    fireEvent.click(toggle);
    expect(header).toHaveAttribute('data-open', 'true');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('hdr-ico')).not.toBeNull(); // the data stays in the DOM either way
  });

  it('the standard calendar has the slim bar and no expander: name, bell and profile, nothing to unfold', async () => {
    mount(width, new DemoDataSource({ today: TODAY }), { headerMode: 'clinic' });
    await ready();
    const bar = screen.getByTestId('club-header');
    expect(bar).toHaveAttribute('data-mode', 'clinic');
    expect(bar).toHaveClass('is-slim');
    expect(screen.queryByTestId('compact-header')).toBeNull();
    expect(screen.queryByTestId('compact-header-toggle')).toBeNull();
    for (const id of ['club-details-strip', 'hdr-ico', 'hdr-contact-phone', 'club-logo-slot', 'club-edit-link']) expect(document.getElementById(id), id).toBeNull();
    expect(bar).not.toHaveTextContent(/KLINIKA|Nastavení firmy|IČO|DIČ|Adresa|Údaje/);
    expect(within(bar).getAllByRole('button')).toHaveLength(2);
    expect(within(bar).getByRole('button', { name: 'Oznámení' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: /^Profil uživatele/ })).toBeInTheDocument();
    // the board and the left column are still all there
    expect(IDS.filter((id) => !['club-details-strip', 'hdr-ico', 'hdr-contact-phone'].includes(id)).filter((id) => !document.getElementById(id))).toEqual([]);
  });

  it('a club screen keeps the full header with its expander', async () => {
    mount(width, new DemoDataSource({ today: TODAY }), { headerMode: 'club' });
    await ready();
    expect(screen.getByTestId('compact-header-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('club-header')).not.toHaveClass('is-slim');
  });

  it('opens one day by default and switches to the whole week', async () => {
    mount(width);
    await ready();
    expect(screen.getByTestId('live-ui')).toHaveAttribute('data-fit', 'day');
    const days = screen.getByTestId('compact-days');
    expect(within(days).getAllByRole('button')).toHaveLength(7);
    const friday = within(days).getByRole('button', { name: /Pá 20\. 11\./ });
    expect(friday).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(days).getByRole('button', { name: /Út 17\. 11\./ }));
    expect(within(days).getByRole('button', { name: /Út 17\. 11\./ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('compact-fit-week'));
    expect(screen.getByTestId('live-ui')).toHaveAttribute('data-fit', 'week');
    expect(screen.queryByTestId('compact-days')).toBeNull();
    expect(screen.getByTestId('compact-fit-week')).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the order summary from the bar and the order overview from "Zpět"', async () => {
    mount(width);
    await ready();
    fireEvent.click(screen.getByTestId('compact-summary-button'));
    expect(document.getElementById('summary-experience-layer')).not.toHaveAttribute('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.getElementById('summary-experience-layer')).toHaveAttribute('hidden'));
    fireEvent.click(within(document.getElementById('order-command')!).getByText('Zpět'));
    expect(await screen.findByText(/Přehled existující objednávky/)).toBeInTheDocument();
  });

  it('standard ordering has no deck and no order bar', async () => {
    mount(width, new DemoDataSource({ today: TODAY }), {});
    await ready();
    // the demo order is a club order: the dock is drawn, `data-standard` is absent
    expect(screen.getByTestId('compact-dock')).not.toHaveAttribute('data-standard');
  });
});

describe('the mini calendar + agenda drawer (tablet) and sheet (phone)', () => {
  it.each([
    ['phone', 390, 'sheet'],
    ['tablet', 834, 'drawer'],
  ] as const)('%s: closed it is inert, the button opens it as a dialog, Esc closes it and the focus goes back', async (_name, width, kind) => {
    mount(width);
    await ready();
    const sidebar = screen.getByTestId('sidebar');
    const opener = screen.getByTestId('compact-calendar-button');
    expect(sidebar).toHaveAttribute('data-compact-sidebar', kind);
    expect(sidebar).toHaveAttribute('data-open', 'false');
    expect(sidebar).toHaveAttribute('inert');
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    opener.focus();
    fireEvent.click(opener);
    expect(sidebar).toHaveAttribute('data-open', 'true');
    expect(sidebar).not.toHaveAttribute('inert');
    expect(sidebar).toHaveAttribute('role', 'dialog');
    expect(sidebar).toHaveAttribute('aria-modal', 'true');
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(document.activeElement).toBe(within(sidebar).getByRole('button', { name: 'Zavřít' })));
    // the panels are the file's own
    expect(within(sidebar).getByTestId('mini-calendar')).toBeInTheDocument();
    expect(within(sidebar).getByTestId('agenda-panel')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(sidebar).toHaveAttribute('data-open', 'false'));
    expect(sidebar).toHaveAttribute('inert');
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('closes with the backdrop and the close button too', async () => {
    mount(390);
    await ready();
    const sidebar = screen.getByTestId('sidebar');
    fireEvent.click(screen.getByTestId('compact-calendar-button'));
    fireEvent.click(screen.getByTestId('compact-backdrop'));
    await waitFor(() => expect(sidebar).toHaveAttribute('data-open', 'false'));
    fireEvent.click(screen.getByTestId('compact-calendar-button'));
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Zavřít' }));
    await waitFor(() => expect(sidebar).toHaveAttribute('data-open', 'false'));
  });

  it('picking a day on the mini calendar closes the sheet', async () => {
    mount(390);
    await ready();
    const sidebar = screen.getByTestId('sidebar');
    fireEvent.click(screen.getByTestId('compact-calendar-button'));
    const empty = document.querySelector<HTMLElement>('#mini-days [data-date="2026-11-24"]')!;
    fireEvent.click(empty);
    await waitFor(() => expect(sidebar).toHaveAttribute('data-open', 'false'));
  });

  it('is a pinned left column from 1000 px: no button, no dialog role, never inert', async () => {
    mount(1024);
    await ready();
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveAttribute('data-compact-sidebar', 'pinned');
    expect(sidebar).not.toHaveAttribute('inert');
    expect(sidebar).not.toHaveAttribute('role');
    expect(screen.queryByTestId('compact-calendar-button')).toBeNull();
    expect(screen.getByTestId('planner-root')).toHaveAttribute('data-layout', 'tablet');
  });
});

describe('club planning by touch: tap the start, tap the end', () => {
  const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', el: Element, where: { clientX: number; clientY: number }, id = 7) =>
    fireEvent[type](el, { button: 0, pointerId: id, pointerType: 'touch', isPrimary: true, ...where });

  async function armed(width: number) {
    const source = ownerSource({ demands: [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }] });
    setViewport(width, 900);
    render(
      <MemoryRouter>
        <PlannerShell source={source} today={TODAY} initialDate={WEEK_DATE} />
      </MemoryRouter>,
    );
    await ready();
    const board = document.getElementById('day-board')!;
    giveBoardGeometry(board);
    fireEvent.click(document.querySelector('[data-plan-type="k"]')!);
    return { source, board };
  }

  it.each([390, 834])('%s px: the first tap shows the start, the second drops the window like a mouse drop', async (width) => {
    const { source, board } = await armed(width);
    touch('pointerDown', board, at(1, 480));
    touch('pointerUp', board, at(1, 480));
    expect(await screen.findByText(/Začátek 08:00 — klepněte na konec/)).toBeInTheDocument();
    expect(document.getElementById('drag-preview')).not.toHaveAttribute('hidden');
    expect(source.snapshotSessions()).toHaveLength(0); // one tap writes nothing
    touch('pointerDown', board, at(1, 600), 8);
    touch('pointerUp', board, at(1, 600), 8);
    await waitFor(() => expect(source.snapshotSessions()).toHaveLength(1));
    expect(source.snapshotSessions()[0]).toMatchObject({ date: '2026-11-17', start: '08:00', end: '10:00', categoryId: 'k' });
  });

  it('a finger that travels (a scroll) is not a tap, and disarming drops the anchor', async () => {
    const { source, board } = await armed(390);
    touch('pointerDown', board, at(1, 480));
    touch('pointerMove', board, at(1, 700));
    touch('pointerUp', board, at(1, 700));
    expect(document.getElementById('drag-preview')).toHaveAttribute('hidden');
    touch('pointerDown', board, at(1, 480));
    touch('pointerUp', board, at(1, 480));
    expect(await screen.findByText(/Začátek 08:00/)).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-plan-type="k"]')!); // tapping the armed card again disarms it
    await waitFor(() => expect(document.getElementById('drag-preview')).toHaveAttribute('hidden'));
    expect(source.snapshotSessions()).toHaveLength(0);
  });
});
