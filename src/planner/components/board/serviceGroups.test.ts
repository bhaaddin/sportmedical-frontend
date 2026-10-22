import { describe, expect, it } from 'vitest';
import type { Calendar } from '../../../api/bookingContracts';
import { aliasMap, groupOn, groupsOnScreen, serviceGroups, toggleGroupSet } from './serviceGroups';

const cal = (id: string, name: string, sortOrder: number, clinicServiceId: string | null, color = '#999999'): Calendar => ({
  id, name, color, location: '', displayStepMinutes: 30, isActive: true, sortOrder, clinicServiceId,
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const services = [
  { id: 's1', name: 'Sportovní lékařské prohlídky', colorHex: '#11AA11' },
  { id: 's2', name: 'Sportovní diagnostika', colorHex: null },
  { id: 's3', name: 'InBody', colorHex: '#3344CC' },
];

describe('serviceGroups (R2)', () => {
  const calendars = [cal('c1', 'Ordinace 1', 0, 's1'), cal('c2', 'Diagnostika', 1, 's2', '#CC2222'), cal('c3', 'InBody', 2, 's3')];

  it('one chip per služba, named and coloured as the služba (the calendar name never reaches it)', () => {
    const groups = serviceGroups(calendars, services);
    expect(groups.map((g) => g.name)).toEqual(['Sportovní lékařské prohlídky', 'Sportovní diagnostika', 'InBody']);
    expect(groups[0]!.colour).toBe('#11AA11');
    expect(groups[1]!.colour).toBe('#CC2222'); // no služba colour: the calendar's
    expect(groups.map((g) => g.primaryId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('a služba with extra (per-činnost) calendars is ONE group; the extras are hidden, not dropped', () => {
    const groups = serviceGroups([...calendars, cal('c4', 'Základní prohlídka', 3, 's1'), cal('c5', 'Spiro', 4, 's1')], services);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ primaryId: 'c1', calendarIds: ['c1', 'c4', 'c5'], hiddenCalendarIds: ['c4', 'c5'] });
    expect(aliasMap(groups).get('c5')).toBe('c1');
    expect(aliasMap(groups).get('c2')).toBe('c2');
  });

  it('a calendar that runs no služba is its own group, named after itself (nothing it holds disappears)', () => {
    const groups = serviceGroups([...calendars, cal('c9', 'Samostatný', 9, null)], services);
    expect(groups.at(-1)).toMatchObject({ id: 'c9', serviceId: null, name: 'Samostatný', primaryId: 'c9' });
  });

  it('lists the činnosti of a služba inside the group', () => {
    const groups = serviceGroups(calendars, services, (id) => (id === 's1' ? [{ id: 'a1', name: 'Základní', colour: '#11AA11' }] : []));
    expect(groups[0]!.activities.map((a) => a.name)).toEqual(['Základní']);
    expect(groups[1]!.activities).toEqual([]);
  });

  describe('clicking', () => {
    const groups = serviceGroups([...calendars, cal('c4', 'Extra', 3, 's1')], services);
    it('from "all", one click shows only that služba (all of its calendars)', () => {
      expect([...toggleGroupSet(null, groups, 's1')!].sort()).toEqual(['c1', 'c4']);
    });
    it('a second služba adds a column; a shown one is hidden by its click', () => {
      const one = toggleGroupSet(null, groups, 's2');
      const two = toggleGroupSet(one, groups, 's1');
      expect(groupsOnScreen(two, groups)).toBe(2);
      expect(groupOn(two, groups[0]!)).toBe(true);
      const back = toggleGroupSet(two, groups, 's2');
      expect([...back!].sort()).toEqual(['c1', 'c4']);
    });
    it('hiding the last one returns to "all"; showing the last hidden one folds into "all"', () => {
      const one = toggleGroupSet(null, groups, 's2');
      expect(toggleGroupSet(one, groups, 's2')).toBeNull();
      const two = toggleGroupSet(toggleGroupSet(one, groups, 's1'), groups, 's3');
      expect(two).toBeNull();
    });
    it('an unknown chip changes nothing', () => {
      expect(toggleGroupSet(null, groups, 'zzz')).toBeNull();
    });
  });
});
