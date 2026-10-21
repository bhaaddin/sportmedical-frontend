/*
 * Reviewer 2.2 on the planner's own day lists: the Den list, the month tile, the phone agenda and the phone month fold a činnost's
 * bookings into ONE line with the count and the slots ("Komplexní prohlídka ×10 · 10 slotů"), openable to the rows behind it.
 * The board still draws each booking as its own card (not covered here).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayAppointment } from '../../../api/bookingContracts';
import { makeContext, type DayMark, type PlannerCategory, type PlannerSession } from '../../model';
import { DayList, MonthMatrix } from './AlternateView';
import { dayListModel, groupDayRows, monthTilesModel, type DayRowModel } from './boardModel';
import { PhoneAgenda, PhoneMonthList } from './PhoneAgenda';
import { phoneEntries, phoneMonthRows, weekStripModel } from './phoneModel';

afterEach(() => cleanup());

const DAY = '2026-12-07';
const komplex: PlannerCategory = { id: 'k', name: 'Komplexní prohlídka', iconKey: 'heart', color: '#e9c46a', slotMinutes: 60, parallelCapacity: 1 };
const zaklad: PlannerCategory = { id: 'z', name: 'Základní prohlídka', iconKey: 'heart', color: '#e76f51', slotMinutes: 40, parallelCapacity: 1 };
const ctx = makeContext({ categories: [zaklad, komplex], sessions: [], today: '2026-10-21' });

const booking = (n: number, activityId: string, activityName: string, hour: number, patient: string | null = `Pacient ${n}`): DayAppointment =>
  ({
    id: `b${n}`, calendarId: 'c1', activityId, activityName, patientName: patient, status: 0,
    startUtc: `2026-12-07T${String(hour - 1).padStart(2, '0')}:00:00Z`, endUtc: `2026-12-07T${String(hour).padStart(2, '0')}:00:00Z`,
  }) as unknown as DayAppointment;
const people = (count: number, activityId: string, activityName: string) => Array.from({ length: count }, (_, i) => booking(i + 1, activityId, activityName, 8 + (i % 9)));
const statusWord = () => 'Objednán';

describe('the Den list model folds a činnost into one row', () => {
  it('ten bookings of one činnost are one group: 10 people, 10 slotů, one time span; a lone booking of another stays a row', () => {
    const list = dayListModel(ctx, DAY, 'all', [...people(10, 'k', 'Komplexní prohlídka'), booking(99, 'z', 'Základní prohlídka', 9)], statusWord, true);
    expect(list.rows).toHaveLength(11);
    const items = groupDayRows(list.rows);
    expect(items).toHaveLength(2);
    const group = items.find((i) => i.type === 'group');
    expect(group?.type === 'group' && group.group).toMatchObject({ categoryId: 'k', name: 'Komplexní prohlídka', count: 10, slots: 10, kind: 'booking' });
    expect(items.filter((i) => i.type === 'row')).toHaveLength(1);
  });

  it('a group booking of three heads counts three', () => {
    const three = { ...booking(1, 'k', 'Komplexní prohlídka', 9), headcount: 3 } as unknown as DayAppointment;
    const list = dayListModel(ctx, DAY, 'all', [three, booking(2, 'k', 'Komplexní prohlídka', 10)], statusWord, true);
    const [item] = groupDayRows(list.rows);
    expect(item?.type === 'group' && item.group).toMatchObject({ count: 4, slots: 4 });
  });

  it('keeps bookings and terms of the same činnost apart, and leaves a lone row alone', () => {
    const sessions: PlannerSession[] = [
      { id: 'w1', date: DAY, start: '08:00', end: '12:00', categoryId: 'z', capacity: 6, booked: 0, origin: 'public', showInList: true },
      { id: 'w2', date: DAY, start: '13:00', end: '16:00', categoryId: 'z', capacity: 4, booked: 0, origin: 'public', showInList: true },
    ];
    const withTerms = makeContext({ categories: [zaklad, komplex], sessions, today: '2026-10-21' });
    const list = dayListModel(withTerms, DAY, 'all', [booking(1, 'z', 'Základní prohlídka', 9), booking(2, 'z', 'Základní prohlídka', 10)], statusWord, false);
    const items = groupDayRows(list.rows);
    expect(items.map((i) => (i.type === 'group' ? `${i.group.kind}:${i.group.count}:${i.group.slots}` : 'row'))).toEqual(['session:2:10', 'booking:2:2']);
  });
});

describe('DayList draws the group row and opens it', () => {
  const rowsOf = (n: number): DayRowModel[] =>
    dayListModel(ctx, DAY, 'all', [...people(n, 'k', 'Komplexní prohlídka'), booking(99, 'z', 'Základní prohlídka', 9)], statusWord, true).rows;
  const model = (n: number) => ({ heading: 'Po 7. 12. 2026 · Denní přehled', rows: rowsOf(n), empty: null });

  it('30 people for one komplexní prohlídka: the day list stays two rows long until opened', () => {
    render(<DayList model={model(30)} onOpen={vi.fn()} onCreate={vi.fn()} />);
    const group = screen.getByTestId('day-group');
    expect(group).toHaveTextContent('Komplexní prohlídka');
    expect(within(group).getByTestId('day-group-count')).toHaveTextContent('×30');
    expect(group).toHaveTextContent('30 slotů');
    expect(document.querySelectorAll('.alt-row')).toHaveLength(2); // the group + the lone booking
    expect(screen.queryByTestId('day-group-members')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: /Zobrazit jednotlivé záznamy/ }));
    expect(within(screen.getByTestId('day-group-members')).getAllByRole('button')).toHaveLength(30);
  });

  it('a row inside the group still opens its own record', () => {
    const onOpen = vi.fn();
    render(<DayList model={model(3)} onOpen={onOpen} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Zobrazit jednotlivé záznamy/ }));
    fireEvent.click(within(screen.getByTestId('day-group-members')).getAllByRole('button')[1]!);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'booking', id: 'b2' }));
  });

  it('the group row says count, slots and span to a screen reader', () => {
    render(<DayList model={model(10)} onOpen={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Komplexní prohlídka ×10, 10 slotů, 08:00 – 17:00/ })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('the month tile and the phone month sum the day by činnost', () => {
  const marks: Record<string, DayMark> = {};
  const month = (bookings: DayAppointment[]) => monthTilesModel(ctx, '2026-12-01', 'all', bookings, marks, true);
  const bookings = [...people(10, 'k', 'Komplexní prohlídka'), booking(50, 'z', 'Základní prohlídka', 9), booking(51, 'z', 'Základní prohlídka', 10)];

  it('the tile of the day lists činnosti with counts, in the catalogue order', () => {
    const tile = month(bookings).tiles.find((t) => t.date === DAY)!;
    expect(tile.activities.map((a) => [a.name, a.count, a.slots])).toEqual([['Základní prohlídka', 2, 2], ['Komplexní prohlídka', 10, 10]]);
  });

  it('draws two lines and a "+n" when a day has more činnosti, with the whole list in the title', () => {
    const tile = month([...bookings, booking(60, 's', 'Spiroergometrie', 11)]).tiles.find((t) => t.date === DAY)!;
    render(<MonthMatrix model={{ heading: 'Prosinec', tiles: [tile] }} onPick={vi.fn()} />);
    const lines = screen.getAllByTestId('tile-activity');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('Základní prohlídka×2');
    expect(lines[1]).toHaveTextContent('Komplexní prohlídka×10');
    expect(screen.getByTestId(`tile-activities-${DAY}`)).toHaveAttribute('title', expect.stringContaining('Komplexní prohlídka ×10 · 10 slotů'));
    expect(document.querySelector('.tile-activity-more')).toHaveTextContent('+1');
  });

  it('the phone month writes one line per činnost', () => {
    const rows = phoneMonthRows(month(bookings).tiles, new Map(), '2026-10-21');
    expect(rows.find((r) => r.date === DAY)?.activities).toEqual(['Základní prohlídka ×2 · 2 sloty', 'Komplexní prohlídka ×10 · 10 slotů']);
    render(<PhoneMonthList heading="Prosinec" rows={rows} onPick={vi.fn()} />);
    expect(screen.getAllByTestId(`phone-month-activity-${DAY}`)).toHaveLength(2);
  });
});

describe('the phone agenda folds the day', () => {
  const rows = dayListModel(ctx, DAY, 'all', [...people(12, 'k', 'Komplexní prohlídka'), booking(99, 'z', 'Základní prohlídka', 9)], statusWord, true).rows;
  const entries = phoneEntries(rows, [], DAY);
  const strip = weekStripModel({ days: [], selected: DAY, today: DAY, dayMarks: {}, rowCount: () => 0, windows: [], inquiries: new Map() });

  it('is two entries: the group and the lone booking', () => {
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.kind === 'group')).toMatchObject({ title: 'Komplexní prohlídka ×12', tail: '12 slotů' });
    expect(entries.find((e) => e.kind === 'group')?.members).toHaveLength(12);
  });

  it('opens to its members and a member opens its booking', () => {
    const onOpenEntry = vi.fn();
    render(<PhoneAgenda heading="Po" strip={strip} entries={entries} empty={null} inquiries={[]} onSelectDay={vi.fn()} onStep={vi.fn()} onOpenEntry={onOpenEntry} onCreate={vi.fn()} canCreate={false} />);
    expect(screen.queryByTestId('phone-group-members')).toBeNull();
    fireEvent.click(screen.getByTestId('phone-group'));
    const members = within(screen.getByTestId('phone-group-members')).getAllByRole('button');
    expect(members).toHaveLength(12);
    fireEvent.click(members[0]!);
    expect(onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ kind: 'booking' }), expect.anything());
  });
});
