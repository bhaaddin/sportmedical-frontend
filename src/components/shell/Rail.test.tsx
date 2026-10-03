/*
 * The rail opens near the pointer, stays for focus and the pin, and folds
 * 300ms after the pointer leaves - unless a settings route holds it open.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarMonth } from '@mui/icons-material';
import { Rail, RailRow, RailPin, RAIL_COLLAPSED, RAIL_EXPANDED, useRailState } from './Rail';

function Harness({ forcedOpen = false }: { forcedOpen?: boolean }) {
  const state = useRailState(forcedOpen);
  return (
    <MemoryRouter>
      <Rail state={state} label="Hlavní navigace">
        <RailRow to="/planovani" label="Kalendář" icon={<CalendarMonth />} active expanded={state.expanded} />
        <button type="button">uvnitř</button>
        <RailPin pinned={state.pinned} onToggle={state.togglePin} />
        <output data-testid="width">{state.width}</output>
      </Rail>
      <button type="button">venku</button>
    </MemoryRouter>
  );
}

const rail = () => screen.getByRole('navigation', { name: 'Hlavní navigace' });
const width = () => Number(screen.getByTestId('width').textContent);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('the rail', () => {
  it('rests at 76px, with the row as an icon and a label under it', () => {
    render(<Harness />);
    expect(width()).toBe(RAIL_COLLAPSED);
    expect(rail()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Kalendář' })).toBeInTheDocument();
  });

  it('opens to 272px when the pointer enters and folds 300ms after it leaves', () => {
    render(<Harness />);
    act(() => { fireEvent.pointerEnter(rail()); });
    expect(width()).toBe(RAIL_EXPANDED);
    expect(rail()).toHaveAttribute('aria-expanded', 'true');

    act(() => { fireEvent.pointerLeave(rail()); });
    /* Still open: the fold waits, so a pointer that grazes the edge does not flicker it. */
    expect(width()).toBe(RAIL_EXPANDED);
    act(() => { vi.advanceTimersByTime(299); });
    expect(width()).toBe(RAIL_EXPANDED);
    act(() => { vi.advanceTimersByTime(1); });
    expect(width()).toBe(RAIL_COLLAPSED);
  });

  it('coming back before the fold cancels it', () => {
    render(<Harness />);
    act(() => { fireEvent.pointerEnter(rail()); fireEvent.pointerLeave(rail()); });
    act(() => { vi.advanceTimersByTime(200); fireEvent.pointerEnter(rail()); vi.advanceTimersByTime(500); });
    expect(width()).toBe(RAIL_EXPANDED);
  });

  it('stays open while something inside it has keyboard focus', () => {
    render(<Harness />);
    const inside = screen.getByRole('button', { name: 'uvnitř' });
    act(() => { inside.focus(); });
    expect(width()).toBe(RAIL_EXPANDED);
    act(() => { screen.getByRole('button', { name: 'venku' }).focus(); });
    expect(width()).toBe(RAIL_COLLAPSED);
  });

  it('stays open when pinned, and remembers the pin in this browser', () => {
    render(<Harness />);
    act(() => { fireEvent.pointerEnter(rail()); });
    fireEvent.click(screen.getByRole('button', { name: 'Připnout lištu otevřenou' }));
    act(() => { fireEvent.pointerLeave(rail()); vi.advanceTimersByTime(1000); });
    expect(width()).toBe(RAIL_EXPANDED);
    expect(localStorage.getItem('sm-rail-pinned')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Odepnout lištu' }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(width()).toBe(RAIL_COLLAPSED);
    expect(localStorage.getItem('sm-rail-pinned')).toBe('0');
  });

  it('is held open on a settings route whatever the pointer does', () => {
    render(<Harness forcedOpen />);
    expect(width()).toBe(RAIL_EXPANDED);
    act(() => { fireEvent.pointerEnter(rail()); fireEvent.pointerLeave(rail()); vi.advanceTimersByTime(1000); });
    expect(width()).toBe(RAIL_EXPANDED);
  });
});
