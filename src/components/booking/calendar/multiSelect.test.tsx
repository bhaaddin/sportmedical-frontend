import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { clubRanges, pickedLabel, type PickedRange } from './multiSelect';
import { SelectionTray } from './SelectionTray';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const time = (id: string, dayKey: string, start: number, end: number): PickedRange => ({
  id,
  kind: 'time',
  columnKey: 'c1',
  calendarId: 'c1',
  activityId: null,
  dayKey,
  range: { start, end },
});
const days = (id: string, from: string, to: string): PickedRange => ({ id, kind: 'days', from, to });
const TODAY = '2026-10-20';

describe('labels', () => {
  it('writes a time range and a run of days', () => {
    expect(pickedLabel(time('a', '2026-10-26', 8 * 60, 12 * 60))).toBe('Po 26. 10. · 08:00–12:00');
    expect(pickedLabel(days('b', '2026-10-26', '2026-10-30'))).toBe('26. 10. – 30. 10.');
  });
});

describe('the club hand-off', () => {
  it('sorts by start and writes whole days without a daily window', () => {
    const ranges = clubRanges(
      [days('a', '2026-11-02', '2026-11-06'), time('b', '2026-10-28', 14 * 60, 17 * 60), time('c', '2026-10-26', 8 * 60, 12 * 60)],
      TODAY,
    );
    expect(ranges).toEqual([
      { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00' },
      { fromDate: '2026-10-28', toDate: '2026-10-28', dailyFrom: '14:00', dailyTo: '17:00' },
      { fromDate: '2026-11-02', toDate: '2026-11-06' },
    ]);
  });

  it('merges overlapping and touching days, and windows on one day', () => {
    expect(
      clubRanges([days('a', '2026-11-02', '2026-11-04'), days('b', '2026-11-05', '2026-11-06'), days('c', '2026-11-04', '2026-11-05')], TODAY),
    ).toEqual([{ fromDate: '2026-11-02', toDate: '2026-11-06' }]);
    expect(clubRanges([time('a', '2026-10-26', 8 * 60, 10 * 60), time('b', '2026-10-26', 10 * 60, 12 * 60)], TODAY)).toEqual([
      { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00' },
    ]);
  });

  it('leaves a past place out; today still counts', () => {
    expect(clubRanges([time('a', '2026-10-19', 8 * 60, 9 * 60)], TODAY)).toEqual([]);
    expect(clubRanges([time('a', TODAY, 8 * 60, 9 * 60)], TODAY)).toHaveLength(1);
  });

  it('writes the end of the day as 23:59', () => {
    const ranges = clubRanges([time('a', '2026-10-26', 20 * 60, 24 * 60), days('b', '2026-11-02', '2026-11-03')], TODAY);
    expect(ranges[0]).toEqual({ fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '20:00', dailyTo: '23:59' });
    expect(ranges[1]).toEqual({ fromDate: '2026-11-02', toDate: '2026-11-03' });
  });
});

describe('the tray on a phone', () => {
  it('is a bar above the bottom navigation that opens to the chips', () => {
    setViewport(VIEWPORTS.phone);
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(
      <SelectionTray
        items={[time('a', '2026-10-26', 8 * 60, 12 * 60), time('b', '2026-10-19', 8 * 60, 9 * 60), days('c', '2026-11-02', '2026-11-06')]}
        today={TODAY}
        phone
        mayBook
        mayBlock
        onRemove={onRemove}
        onClear={onClear}
        onBlock={vi.fn()}
      />,
    );
    expect(screen.getByTestId('selection-tray')).toHaveAttribute('data-variant', 'bar');
    expect(screen.getByText('3 termíny')).toBeInTheDocument();
    expect(screen.queryAllByTestId('tray-chip')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit termíny' }));
    expect(screen.getAllByTestId('tray-chip')).toHaveLength(3);
    expect(screen.getByText('v minulosti')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Odebrat termín Po 26\. 10\./ }));
    expect(onRemove).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit výběr' }));
    expect(onClear).toHaveBeenCalled();
    /*
     * A club order is never STARTED from marked places - several places never offer it either, "Přidat do
     * objednávky klubu" needs exactly one (the dialog attaches ONE range to ONE order).
     */
    expect(screen.queryByRole('button', { name: /klub/i })).not.toBeInTheDocument();
  });

  it('offers no club action for a past single place, even with the callback wired', () => {
    render(
      <SelectionTray
        items={[time('b', '2026-10-19', 8 * 60, 9 * 60)]}
        today={TODAY}
        phone={false}
        mayBook
        mayBlock
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onAddToClubOrder={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /klub/i })).not.toBeInTheDocument();
  });

  it('"Přidat do objednávky klubu" (Etapa 12) offers for exactly one future place, never a path to a new order', () => {
    const onAddToClubOrder = vi.fn();
    render(
      <SelectionTray
        items={[time('a', '2026-10-26', 8 * 60, 9 * 60)]}
        today={TODAY}
        phone={false}
        mayBook
        mayBlock
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onBlock={vi.fn()}
        onAddToClubOrder={onAddToClubOrder}
      />,
    );
    const button = screen.getByTestId('tray-add-to-club-order');
    expect(button).toHaveTextContent('Přidat do objednávky klubu');
    fireEvent.click(button);
    expect(onAddToClubOrder).toHaveBeenCalled();
    /* Never an entry to create a new order from here. */
    expect(screen.queryByRole('button', { name: /telefonická objednávka/i })).not.toBeInTheDocument();
  });

  it('no club action without `mayBook`, and none without the callback', () => {
    const { rerender } = render(
      <SelectionTray
        items={[time('a', '2026-10-26', 8 * 60, 9 * 60)]}
        today={TODAY}
        phone={false}
        mayBook={false}
        mayBlock
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onAddToClubOrder={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('tray-add-to-club-order')).not.toBeInTheDocument();
    rerender(
      <SelectionTray
        items={[time('a', '2026-10-26', 8 * 60, 9 * 60)]}
        today={TODAY}
        phone={false}
        mayBook
        mayBlock
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('tray-add-to-club-order')).not.toBeInTheDocument();
  });
});
