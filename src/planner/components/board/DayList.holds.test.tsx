/*
 * R13 on the desktop "Den" list: the days agreed with a club are visible in the day list too - hatched in the club's colour, with the club's
 * name, the order code and "Čeká na hráče" - even before its players are in, and the day does not read as empty.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayList } from './AlternateView';
import type { PhoneEntry } from './phoneModel';

afterEach(() => cleanup());

const hold: PhoneEntry = {
  key: 'w-1', kind: 'club', id: 'w-1', sortStart: 510, timeLabel: '08:30–10:45', title: 'FK Slaný', sub: 'KO-ABCD1234 · Čeká na hráče',
  tail: null, priceText: null, colour: '#2563EB', window: null, acts: [], members: null,
};
const empty = { heading: 'Čt 5. 11. 2026 · Denní přehled', rows: [], empty: 'Žádné termíny.' };

describe('DayList draws a club hold', () => {
  it('names the club, the order code and the hold state in words, and is a button', () => {
    const onOpenHold = vi.fn();
    render(<DayList model={empty} onOpen={vi.fn()} onCreate={vi.fn()} holds={[hold]} onOpenHold={onOpenHold} />);
    const row = screen.getByTestId('day-hold-w-1');
    expect(row).toHaveTextContent('08:30–10:45');
    expect(row).toHaveTextContent('FK Slaný');
    expect(row).toHaveTextContent('KO-ABCD1234 · Čeká na hráče');
    expect(row.className).toContain('is-hold');
    fireEvent.click(row);
    expect(onOpenHold).toHaveBeenCalledTimes(1);
    expect(onOpenHold.mock.calls[0]![0]).toBe(hold);
  });

  it('a day with only a hold is not "empty": no empty state, no "Vytvořit termín" over the club\'s time', () => {
    render(<DayList model={empty} onOpen={vi.fn()} onCreate={vi.fn()} holds={[hold]} />);
    expect(screen.queryByText('Žádné termíny.')).toBeNull();
  });

  it('without holds the empty day looks as before', () => {
    render(<DayList model={empty} onOpen={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText('Žádné termíny.')).toBeInTheDocument();
    expect(screen.queryByTestId('day-hold-w-1')).toBeNull();
  });
});
