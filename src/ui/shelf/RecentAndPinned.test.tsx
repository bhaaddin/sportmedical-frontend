/*
 * "Připnuté a nedávné": the person's own shelf. Pinned first, then what they opened last; kept in their own browser by id
 * and name; permission-aware; one control pins and says what it does.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { clearRecents, getMemory, rememberOpened, resetMemoryCacheForTests, togglePinned } from './memory';
import { PinButton, RecentAndPinned, whenWords } from './RecentAndPinned';

const patient = (n: number) => ({ kind: 'patient', id: `p${n}`, label: `Pacient ${n}` });

const renderShelf = (ui = <RecentAndPinned />) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  resetMemoryCacheForTests();
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage']));
});

describe('RecentAndPinned', () => {
  it('says what to do while it is empty, and offers the next action', () => {
    renderShelf(<RecentAndPinned emptyAction={{ label: 'Všichni pacienti', to: '/patients' }} />);
    const region = screen.getByRole('region', { name: 'Připnuté a nedávné' });
    expect(region).toHaveAttribute('data-state', 'empty');
    expect(within(region).getByRole('link', { name: 'Všichni pacienti' })).toHaveAttribute('href', '/patients');
  });

  it('draws nothing at all when asked to be quiet while empty', () => {
    const { container } = renderShelf(<RecentAndPinned hideWhenEmpty />);
    expect(container.querySelector('[data-shelf]')).toBeNull();
  });

  it('lists what was opened last first, each a link to the thing, with when', () => {
    rememberOpened(patient(1));
    rememberOpened({ kind: 'club', id: 'c1', label: 'FC Sparta' });
    renderShelf();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('link', { name: 'Klub: FC Sparta' })).toHaveAttribute('href', '/clubs/c1');
    expect(within(cards[1]).getByRole('link', { name: 'Pacient: Pacient 1' })).toHaveAttribute('href', '/patients/p1');
    expect(within(cards[0]).getByText(/Otevřeno dnes/)).toBeInTheDocument();
  });

  it('puts a pinned entry first and shows it once', () => {
    rememberOpened(patient(1));
    rememberOpened(patient(2));
    togglePinned(patient(1));
    renderShelf();
    const names = screen.getAllByRole('listitem').map((c) => within(c).getAllByRole('link')[0].getAttribute('aria-label'));
    expect(names).toEqual(['Pacient: Pacient 1', 'Pacient: Pacient 2']);
    expect(screen.getByText('Připnuto')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2); /* shown once: the pinned card is not repeated among the recents */
  });

  it('hides what the person may not open, and filters by kind', () => {
    rememberOpened({ kind: 'invoice', id: 'i1', label: 'FA-1' });
    rememberOpened(patient(1));
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    const { unmount } = renderShelf();
    expect(screen.queryByText('FA-1')).toBeNull();
    expect(screen.getByText('Pacient 1')).toBeInTheDocument();
    unmount();

    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage']));
    renderShelf(<RecentAndPinned kinds={['invoice']} />);
    expect(screen.getByText('FA-1')).toBeInTheDocument();
    expect(screen.queryByText('Pacient 1')).toBeNull();
  });

  it('clears the history (and only the history)', async () => {
    rememberOpened(patient(1));
    togglePinned(patient(2));
    renderShelf();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Vymazat historii' }));
    expect(getMemory().recents).toEqual([]);
    expect(getMemory().pinned).toHaveLength(1);
  });

  it('follows a change made elsewhere (another shelf on the page pins)', () => {
    renderShelf();
    expect(screen.getByRole('region')).toHaveAttribute('data-state', 'empty');
    act(() => rememberOpened(patient(7)));
    expect(screen.getByText('Pacient 7')).toBeInTheDocument();
  });

  it('shows at most `limit` cards', () => {
    for (let i = 1; i <= 8; i += 1) rememberOpened(patient(i));
    renderShelf(<RecentAndPinned limit={3} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('PinButton', () => {
  it('pins and unpins, and says which it will do', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PinButton entity={patient(1) as never} /></MemoryRouter>);
    const pin = screen.getByRole('button', { name: 'Připnout: Pacient 1' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    await user.click(pin);
    expect(getMemory().pinned.map((p) => p.id)).toEqual(['p1']);
    const unpin = screen.getByRole('button', { name: 'Odepnout: Pacient 1' });
    expect(unpin).toHaveAttribute('aria-pressed', 'true');
    await user.click(unpin);
    expect(getMemory().pinned).toEqual([]);
  });

  it('is refused, and says so, when twelve are already pinned', () => {
    for (let i = 1; i <= 12; i += 1) togglePinned(patient(i));
    render(<MemoryRouter><PinButton entity={patient(99) as never} /></MemoryRouter>);
    const pin = screen.getByRole('button', { name: /Nelze připnout/ });
    expect(pin).toBeDisabled();
  });
});

describe('whenWords', () => {
  const NOW = new Date('2026-10-21T10:00:00Z');
  it('says today with the time, yesterday, how many days, then a date', () => {
    expect(whenWords(Date.parse('2026-10-21T07:15:00Z'), NOW)).toMatch(/^dnes \d{1,2}:15$/);
    expect(whenWords(Date.parse('2026-10-20T07:15:00Z'), NOW)).toBe('včera');
    expect(whenWords(Date.parse('2026-10-18T07:15:00Z'), NOW)).toBe('před 3 dny');
    expect(whenWords(Date.parse('2026-10-01T07:15:00Z'), NOW)).toBe('1. 10.');
  });
});

describe('after sign-out of one person and sign-in of another', () => {
  it('does not show the first person\'s recents to the second', () => {
    rememberOpened(patient(1));
    localStorage.setItem('user', JSON.stringify({ id: 'u2' }));
    clearRecents();
    resetMemoryCacheForTests();
    localStorage.setItem('user', JSON.stringify({ id: 'u2' }));
    renderShelf();
    expect(screen.queryByText('Pacient 1')).toBeNull();
  });
});
