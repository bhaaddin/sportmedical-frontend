/*
 * Reviewer 2.2 in the agenda ("Činnosti termínů v kalendáři", "Všechny termíny"): standard booking lists one row per činnost and day
 * with the count and the slots, the KPI counts people (not the free parallel seats of a booking), and the totals follow.
 */
import { describe, expect, it } from 'vitest';
import { initialAgendaUi, makeContext, type PlannerCategory, type PlannerSession } from '../../model';
import { agendaView } from './agendaView';

const komplex: PlannerCategory = { id: 'k', name: 'Komplexní prohlídka', iconKey: 'heart', color: '#e9c46a', slotMinutes: 60, parallelCapacity: 2 };
const zaklad: PlannerCategory = { id: 'z', name: 'Základní prohlídka', iconKey: 'heart', color: '#e76f51', slotMinutes: 40, parallelCapacity: 1 };

const booking = (id: string, categoryId: string, date: string, start: string, end: string, capacity = 1): PlannerSession => ({
  id, date, start, end, categoryId, booked: 1, capacity, origin: 'public', showInList: true, appointmentIds: [id],
  appointments: [{ id, calendarId: 'c1', patientName: `P ${id}`, status: 0, heads: 1, priceCzk: null }],
});
const window_ = (id: string, categoryId: string, date: string, capacity: number): PlannerSession => ({ id, date, start: '13:00', end: '16:00', categoryId, booked: 0, capacity, origin: 'public', showInList: true });

const sessions = [
  ...Array.from({ length: 10 }, (_, i) => booking(`k${i}`, 'k', '2026-12-07', `${String(8 + i).padStart(2, '0')}:00`, `${String(9 + i).padStart(2, '0')}:00`, 2)),
  booking('k-next', 'k', '2026-12-08', '09:00', '10:00', 2),
  booking('z1', 'z', '2026-12-07', '08:00', '08:40'), booking('z2', 'z', '2026-12-07', '08:45', '09:25'),
  window_('w', 'z', '2026-12-07', 3),
];
const ctx = makeContext({ categories: [zaklad, komplex], sessions, today: '2026-10-21' });
const view = { weekStart: '2026-12-07', selectedDate: '2026-12-07' };
const standard = (ui = initialAgendaUi) => agendaView(ctx, ui, view, 'standard');

describe('the činnost list in standard booking', () => {
  it('ten bookings of a činnost on a day are ONE row: x10, 10 slotů; the next day is its own row', () => {
    const m = standard({ ...initialAgendaUi, categoryId: 'k' });
    expect(m.activityRows).toHaveLength(2);
    expect(m.activityRows[0]).toMatchObject({ date: '2026-12-07', name: 'Komplexní prohlídka ×10', slots: 10, slotLabel: 'slotů', timeRange: '08:00–18:00' });
    expect(m.activityRows[0]!.group).toMatchObject({ count: 10 });
    expect(m.activityRows[0]!.group?.entryIds).toHaveLength(10);
    /* a činnost with one entry on its day keeps its own row and its detail */
    expect(m.activityRows[1]).toMatchObject({ date: '2026-12-08', id: 'k-next', name: 'Komplexní prohlídka', slots: 1 });
    expect(m.activityRows[1]!.group).toBeUndefined();
  });

  it('the KPI counts people: eleven bookings are 11 slots, not the 22 seats of a činnost with two parallel places', () => {
    const m = standard({ ...initialAgendaUi, categoryId: 'k' });
    expect(m.kpi).toMatchObject({ name: 'Komplexní prohlídka', planned: 11 });
    expect(m.kpi?.termCountLabel).toBe('11 termínů');
    expect(m.termCaption).toBe('11 termínů');
  });

  it('a činnost with bookings and a window adds both: people + capacity', () => {
    const m = standard({ ...initialAgendaUi, categoryId: 'z' });
    expect(m.kpi?.planned).toBe(5);
    expect(m.activityRows).toHaveLength(1);
    expect(m.activityRows[0]).toMatchObject({ name: 'Základní prohlídka ×3', slots: 5 });
  });

  it('"Všechny termíny" folds the same way and the totals add up', () => {
    const m = standard({ ...initialAgendaUi, mode: 'all' });
    expect(m.allRows.map((r) => [r.date, r.name, r.slots])).toEqual([
      ['2026-12-07', 'Základní prohlídka ×3', 5],
      ['2026-12-07', 'Komplexní prohlídka ×10', 10],
      ['2026-12-08', 'Komplexní prohlídka', 1],
    ]);
    expect(m.allTotals).toMatchObject({ terms: 14, slots: 16 });
    expect(m.totalCount).toBe(14);
    expect(m.footerStatus).toBe('14 termínů v kalendáři');
  });

  it('the day scope folds what it keeps', () => {
    const day = standard({ ...initialAgendaUi, mode: 'all', scope: 'day' });
    expect(day.allRows).toHaveLength(2);
    expect(day.allTotals).toMatchObject({ terms: 13, slots: 15 });
  });
});
