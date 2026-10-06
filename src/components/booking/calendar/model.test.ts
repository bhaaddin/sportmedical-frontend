import { describe, expect, it } from 'vitest';
import type { Activity, Calendar, DayAppointment, PreviewDay } from '../../../api/bookingContracts';
import {
  activityInfoOf,
  afternoonFree,
  buildColumns,
  clubBlockDates,
  colourOfActivity,
  countByService,
  dayCount,
  daysOf,
  daysWord,
  layoutLanes,
  orderRange,
  passesService,
  peopleWord,
  rangeDates,
  rangePill,
  serviceIdOfAppointment,
  type Catalogue,
} from './model';
import { cardTones, mixOver } from './colors';

const activity = (id: string, name: string, over: Partial<Activity> = {}): Activity =>
  ({
    id,
    name,
    slug: id,
    durationMinutes: 30,
    color: '#000000',
    publicNote: '',
    isPubliclyBookable: true,
    requiresReportByEmail: false,
    requiresClubSharing: false,
    questionnaireRequirement: 'NotAsked',
    sortOrder: 0,
    isActive: true,
    serviceItemId: null,
    priceCzk: null,
    clinicServiceId: 's1',
    questionnaireDefinitionId: null,
    ...over,
  }) as Activity;

const catalogue: Catalogue = {
  activities: new Map(
    [
      activityInfoOf(activity('a1', 'Základní', { effectiveColorHex: '#1565C0', sortOrder: 1 })),
      activityInfoOf(activity('a2', 'Komplexní', { effectiveColorHex: '#0D47A1', sortOrder: 2, parallelCapacity: 2 })),
      activityInfoOf(activity('a3', 'Spiroergometrie', { clinicServiceId: 's2', sortOrder: 3 })),
      activityInfoOf(activity('a4', 'Stará', { isActive: false, clinicServiceId: 's2', sortOrder: 4 })),
    ].map((a) => [a.id, a] as const),
  ),
  services: new Map([
    ['s1', { id: 's1', name: 'Prohlídky', colorHex: '#1565C0', sortOrder: 1, isActive: true }],
    ['s2', { id: 's2', name: 'Diagnostika', colorHex: '#2E7D32', sortOrder: 2, isActive: true }],
  ]),
};

const calendar = (id: string, name: string, over: Partial<Calendar> = {}): Calendar => ({
  id,
  name,
  color: '#999999',
  location: '',
  displayStepMinutes: 30,
  isActive: true,
  sortOrder: 0,
  clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null,
  publicHorizonDays: null,
  publicHoldMinutes: null,
  publicCancellationHours: null,
  ...over,
});

const row = (date: string, offered: string[]): PreviewDay => ({
  date,
  isOpen: true,
  closedBecause: null,
  startTime: '08:00:00',
  endTime: '16:00:00',
  breakStart: null,
  breakEnd: null,
  workerUserId: null,
  workerDisplayName: null,
  isChangedByOverride: false,
  offeredActivityIds: offered,
});

const appt = (id: string, activityId: string, over: Partial<DayAppointment> = {}): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: 'p',
  activityId,
  activityName: 'X',
  startUtc: '2026-10-26T07:00:00Z',
  endUtc: '2026-10-26T08:00:00Z',
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  ...over,
});

describe('colours of činnosti', () => {
  it('uses the činnost’s effective colour, then its service’s, then the fallback', () => {
    expect(colourOfActivity(catalogue, 'a1', '#999999')).toBe('#1565C0');
    /* a3 sent no colour: the service s2 supplies it. */
    expect(colourOfActivity(catalogue, 'a3', '#999999')).toBe('#2E7D32');
    expect(colourOfActivity(catalogue, 'nope', '#999999')).toBe('#999999');
    expect(colourOfActivity(catalogue, null, '#999999')).toBe('#999999');
  });

  it('ignores a colour that is not #RRGGBB', () => {
    const a = activityInfoOf(activity('x', 'X', { effectiveColorHex: 'blue', colorHex: '#123456' }));
    expect(a.colorHex).toBe('#123456');
    const b = activityInfoOf(activity('y', 'Y', { effectiveColorHex: 'blue' }));
    expect(b.colorHex).toBeNull();
  });

  it('mixes a card’s tint from the činnost colour over the surface', () => {
    expect(mixOver('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixOver('nope', '#FFFFFF', 0.5)).toBe('#FFFFFF');
    const tones = cardTones('#1565C0', '#FFFFFF');
    expect(tones.edge).toBe('#1565C0');
    expect(tones.bg).not.toBe(tones.bgActive);
  });

  it('the service of an appointment comes through its činnost, else its calendar', () => {
    expect(serviceIdOfAppointment(appt('1', 'a3'), calendar('c1', 'K'), catalogue)).toBe('s2');
    expect(serviceIdOfAppointment(appt('1', 'unknown'), calendar('c1', 'K', { clinicServiceId: 's1' }), catalogue)).toBe('s1');
  });

  it('a service filter passes unknown services and the ticked ones', () => {
    expect(passesService('s1', null)).toBe(true);
    expect(passesService('s1', new Set(['s2']))).toBe(false);
    expect(passesService(null, new Set(['s2']))).toBe(true);
  });
});

describe('the columns of the day view', () => {
  const days = ['2026-10-26'];
  const preview = new Map([['c1', new Map([['2026-10-26', row('2026-10-26', ['a2', 'a1', 'a4'])]])]]);

  it('is one column per offered činnost, in the činnost order, coloured by it', () => {
    const columns = buildColumns({
      calendars: [calendar('c1', 'Ordinace 1')],
      catalogue,
      previewByCalendar: preview,
      days,
      appointments: [],
      serviceFilter: null,
    });
    /* a4 is inactive and is left out. */
    expect(columns.map((c) => c.title)).toEqual(['Základní', 'Komplexní']);
    expect(columns.map((c) => c.colorHex)).toEqual(['#1565C0', '#0D47A1']);
    expect(columns[1].capacity).toBe(2);
    expect(columns[0].key).toBe('c1:a1');
  });

  it('keeps a booking on a činnost the calendar no longer offers in a column of its own', () => {
    const columns = buildColumns({
      calendars: [calendar('c1', 'Ordinace 1')],
      catalogue,
      previewByCalendar: preview,
      days,
      appointments: [appt('1', 'gone', { activityName: 'Zrušená činnost' })],
      serviceFilter: null,
    });
    expect(columns.map((c) => c.title)).toContain('Zrušená činnost');
  });

  it('groups by calendar and a calendar with no činnosti known is one column named after it', () => {
    const columns = buildColumns({
      calendars: [calendar('c1', 'Ordinace 1'), calendar('c2', 'Ordinace 2')],
      catalogue,
      previewByCalendar: preview,
      days,
      appointments: [],
      serviceFilter: null,
    });
    expect(columns.map((c) => `${c.calendarId}:${c.title}`)).toEqual([
      'c1:Základní',
      'c1:Komplexní',
      'c2:Ordinace 2',
    ]);
  });

  it('the service filter takes a service’s columns away', () => {
    const columns = buildColumns({
      calendars: [calendar('c1', 'Ordinace 1')],
      catalogue,
      previewByCalendar: new Map([['c1', new Map([['2026-10-26', row('2026-10-26', ['a1', 'a3'])]])]]),
      days,
      appointments: [],
      serviceFilter: new Set(['s2']),
    });
    expect(columns.map((c) => c.title)).toEqual(['Spiroergometrie']);
  });

  it('says "odpoledne volno" only for a činnost with bookings that all end before noon', () => {
    expect(afternoonFree({ bookings: [{ start: 9 * 60 }], workEnd: 16 * 60 })).toBe(true);
    expect(afternoonFree({ bookings: [{ start: 9 * 60 }, { start: 13 * 60 }], workEnd: 16 * 60 })).toBe(false);
    expect(afternoonFree({ bookings: [], workEnd: 16 * 60 })).toBe(false);
    expect(afternoonFree({ bookings: [{ start: 9 * 60 }], workEnd: 12 * 60 })).toBe(false);
    expect(afternoonFree({ bookings: [{ start: 9 * 60 }], workEnd: null })).toBe(false);
  });
});

describe('simultaneous bookings in lanes', () => {
  const item = (id: string, start: number, end: number) => ({ id, start, end });

  it('puts overlapping bookings side by side and leaves the rest full width', () => {
    const { placed, overflow } = layoutLanes([item('a', 600, 660), item('b', 630, 690), item('c', 720, 780)]);
    expect(placed.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(placed.get('b')).toEqual({ lane: 1, lanes: 2 });
    /* Does not touch the first two: its own cluster, one lane. */
    expect(placed.get('c')).toEqual({ lane: 0, lanes: 1 });
    expect(overflow).toEqual([]);
  });

  it('back to back is not simultaneous', () => {
    const { placed } = layoutLanes([item('a', 600, 660), item('b', 660, 720)]);
    expect(placed.get('a')?.lanes).toBe(1);
    expect(placed.get('b')?.lanes).toBe(1);
  });

  it('reuses a free lane', () => {
    const { placed } = layoutLanes([item('a', 600, 720), item('b', 600, 630), item('c', 640, 700)]);
    expect(placed.get('b')?.lane).toBe(1);
    expect(placed.get('c')?.lane).toBe(1);
    expect(placed.get('a')?.lanes).toBe(2);
  });

  it('folds lanes past the third into one "+N" chip', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, 600, 660));
    const { placed, overflow } = layoutLanes(items);
    expect(placed.size).toBe(2);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].ids).toHaveLength(3);
    expect(overflow[0].lane).toBe(2);
    expect(overflow[0].lanes).toBe(3);
    for (const p of placed.values()) expect(p.lanes).toBe(3);
  });
});

describe('people on a day, by service', () => {
  const calendars = new Map([['c1', calendar('c1', 'K')]]);
  const count = (appointments: DayAppointment[]) =>
    countByService({ appointments, calendarById: calendars, catalogue, otherLabel: 'Ostatní' });

  it('splits by službu with the činnosti under each, ordered by the služba', () => {
    const result = count([
      appt('1', 'a1'),
      appt('2', 'a1'),
      appt('3', 'a2'),
      appt('4', 'a3'),
    ]);
    expect(result.total).toBe(4);
    expect(result.services.map((s) => `${s.name} ${s.total}`)).toEqual(['Prohlídky 3', 'Diagnostika 1']);
    expect(result.services[0].activities).toEqual([
      { activityId: 'a1', name: 'Základní', count: 2 },
      { activityId: 'a2', name: 'Komplexní', count: 1 },
    ]);
  });

  it('counts a group booking per head and a missing headcount as one', () => {
    const result = count([appt('1', 'a1', { headcount: 8, partnerName: 'FK Slaný' }), appt('2', 'a1')]);
    expect(result.total).toBe(9);
    expect(result.services[0].total).toBe(9);
  });

  it('leaves cancelled bookings out', () => {
    expect(count([appt('1', 'a1'), appt('2', 'a1', { status: 4 })]).total).toBe(1);
  });

  it('a činnost the catalogue does not know goes under its calendar’s service by its own name', () => {
    const result = count([appt('1', 'mystery', { activityName: 'Neznámá' })]);
    expect(result.services[0].name).toBe('Prohlídky');
    expect(result.services[0].activities[0].name).toBe('Neznámá');
  });

  it('says people in Czech', () => {
    expect([1, 2, 4, 5, 12].map(peopleWord)).toEqual(['1 osoba', '2 osoby', '4 osoby', '5 osob', '12 osob']);
  });
});

describe('a run of days', () => {
  const range = { from: '2026-10-26', to: '2026-11-08' };

  it('is ordered, counted both ends in, and named', () => {
    expect(orderRange('2026-11-08', '2026-10-26')).toEqual(range);
    expect(dayCount(range)).toBe(14);
    expect(rangeDates(range)).toBe('26. 10. – 8. 11.');
    expect(rangePill({ from: '2026-10-26', to: '2026-11-09' })).toBe('26. 10. – 9. 11. · 15 dní');
    expect(daysOf({ from: '2026-10-30', to: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect([1, 3, 14].map(daysWord)).toEqual(['1 den', '3 dny', '14 dní']);
  });

  it('a club block reaches from its first piece to its last, midnight belonging to the day before', () => {
    const blocks = [
      { clubBlockId: 'k1', startUtc: '2026-10-25T23:00:00Z', endUtc: '2026-10-26T15:00:00Z' },
      { clubBlockId: 'k1', startUtc: '2026-11-08T23:00:00Z', endUtc: '2026-11-09T23:00:00Z' },
      { clubBlockId: 'other', startUtc: '2026-12-01T08:00:00Z', endUtc: '2026-12-01T09:00:00Z' },
    ];
    /* 26. 10. 00:00 Prague is 25. 10. 23:00 UTC; the last piece ends at 10. 11. 00:00 Prague. */
    expect(clubBlockDates(blocks, 'k1', blocks[0])).toEqual({ from: '2026-10-26', to: '2026-11-09' });
    expect(clubBlockDates(blocks, null, blocks[2])).toEqual({ from: '2026-12-01', to: '2026-12-01' });
  });
});
