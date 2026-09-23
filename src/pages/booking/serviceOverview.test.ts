/*
 * Přehled podle služeb, counted without a browser.
 *
 * What only these can show: that "kdo" is read from the rota for the Prague
 * date the appointment falls on (an instant just before midnight UTC is the
 * next day in Prague), that the employee filter narrows the free starts as
 * well as the appointments, and that an činnost offered but not yet booked
 * still has a row - the empty row is the free capacity.
 */
import { describe, it, expect } from 'vitest';
import type { Activity, DayAppointment, PreviewDay } from '../../api/bookingContracts';
import type { ClinicService } from '../../api/clinicServices';
import {
  buildOverview,
  groupByService,
  offeredPairs,
  overviewTotals,
  workerIndex,
  workersInRange,
  type CalendarPreview,
} from './serviceOverview';

const service = (id: string, name: string, sortOrder: number): ClinicService => ({
  id,
  name,
  description: '',
  sortOrder,
  isActive: true,
  activities: 0,
  calendars: 0,
});

const activity = (id: string, name: string, clinicServiceId: string | null, sortOrder = 0): Activity => ({
  id,
  name,
  slug: id,
  durationMinutes: 30,
  color: '#0D7377',
  publicNote: '',
  isPubliclyBookable: true,
  requiresReportByEmail: false,
  requiresClubSharing: false,
  questionnaireRequirement: 'NotAsked',
  sortOrder,
  isActive: true,
  serviceItemId: null,
  priceCzk: null,
  clinicServiceId,
});

const day = (date: string, over: Partial<PreviewDay> = {}): PreviewDay => ({
  date,
  isOpen: true,
  closedBecause: null,
  startTime: '08:00:00',
  endTime: '16:00:00',
  breakStart: null,
  breakEnd: null,
  workerUserId: 'u-novak',
  workerDisplayName: 'MUDr. Novák',
  isChangedByOverride: false,
  offeredActivityIds: ['a-basic', 'a-spiro'],
  ...over,
});

const appointment = (id: string, over: Partial<DayAppointment> = {}): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'a-basic',
  activityName: 'Základní prohlídka',
  startUtc: '2026-10-06T07:00:00Z',
  endUtc: '2026-10-06T07:30:00Z',
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  ...over,
});

const services = [service('s-exam', 'Sportovní prohlídky', 0), service('s-diag', 'Sportovní diagnostika', 1)];
const activities = [
  activity('a-basic', 'Základní prohlídka', 's-exam', 0),
  activity('a-spiro', 'Spiroergometrie', 's-exam', 1),
  activity('a-inbody', 'InBody', 's-diag', 0),
];

/* Tuesday 6. 10. and Wednesday 7. 10. 2026 on calendar c1; Novák on Tuesday, Dvořáková on Wednesday. */
const previews: CalendarPreview[] = [
  {
    calendarId: 'c1',
    days: [
      day('2026-10-05', { isOpen: false, closedBecause: 'holiday', workerUserId: null, workerDisplayName: null, offeredActivityIds: [] }),
      day('2026-10-06'),
      day('2026-10-07', { workerUserId: 'u-dvorakova', workerDisplayName: 'MUDr. Dvořáková' }),
    ],
  },
  {
    calendarId: 'c2',
    days: [day('2026-10-06', { workerUserId: null, workerDisplayName: null, offeredActivityIds: ['a-inbody'] })],
  },
];

describe('who works when', () => {
  it('indexes the rota by calendar and date, nobody as null', () => {
    const index = workerIndex(previews);

    expect(index.get('c1|2026-10-06')).toEqual({ id: 'u-novak', name: 'MUDr. Novák' });
    expect(index.get('c1|2026-10-07')?.name).toBe('MUDr. Dvořáková');
    expect(index.get('c2|2026-10-06')).toBeNull();
    expect(index.has('c1|2026-10-08')).toBe(false);
  });

  it('lists each worker once, by name, and skips closed days', () => {
    const closedOnly: CalendarPreview[] = [
      { calendarId: 'c1', days: [day('2026-10-05', { isOpen: false, workerUserId: 'u-ghost', workerDisplayName: 'Nikdo' })] },
    ];

    expect(workersInRange(previews).map((w) => w.name)).toEqual(['MUDr. Dvořáková', 'MUDr. Novák']);
    expect(workersInRange(closedOnly)).toEqual([]);
  });

  it('asks availability only about pairs some open day offers', () => {
    expect(offeredPairs(previews)).toEqual([
      { calendarId: 'c1', activityId: 'a-basic' },
      { calendarId: 'c1', activityId: 'a-spiro' },
      { calendarId: 'c2', activityId: 'a-inbody' },
    ]);
  });
});

describe('the overview', () => {
  const everybody = { workerId: null, serviceId: null };

  const appointments = [
    appointment('t1'),
    appointment('t2', { startUtc: '2026-10-06T09:00:00Z', endUtc: '2026-10-06T09:30:00Z', status: 2 }),
    /* 22:30Z on the 6th is 00:30 on Wednesday the 7th in Prague - Dvořáková's day. */
    appointment('t3', { startUtc: '2026-10-06T22:30:00Z', endUtc: '2026-10-06T23:00:00Z' }),
    appointment('t4', { startUtc: '2026-10-07T08:00:00Z', endUtc: '2026-10-07T08:30:00Z', status: 4 }),
    appointment('t5', { activityId: 'a-inbody', activityName: 'InBody', calendarId: 'c2', status: 5 }),
  ];

  const offered = [
    {
      calendarId: 'c1',
      activityId: 'a-basic',
      slots: [
        { startUtc: '2026-10-06T10:00:00Z', endUtc: '2026-10-06T10:30:00Z' },
        { startUtc: '2026-10-06T10:15:00Z', endUtc: '2026-10-06T10:45:00Z' },
        { startUtc: '2026-10-07T10:00:00Z', endUtc: '2026-10-07T10:30:00Z' },
      ],
    },
    { calendarId: 'c1', activityId: 'a-spiro', slots: [{ startUtc: '2026-10-07T12:00:00Z', endUtc: '2026-10-07T13:00:00Z' }] },
    { calendarId: 'c2', activityId: 'a-inbody', slots: [] },
  ];

  it('counts per činnost: booked, cancelled and no-show apart', () => {
    const rows = buildOverview({ activities, services, appointments, previews, offered, filter: everybody });
    const basic = rows.find((r) => r.activityId === 'a-basic');
    const inbody = rows.find((r) => r.activityId === 'a-inbody');

    expect(basic).toMatchObject({ booked: 3, cancelled: 1, noShow: 0 });
    expect(inbody).toMatchObject({ booked: 0, cancelled: 0, noShow: 1 });
    /* Listed, not hidden (6.6). */
    expect(basic?.appointments.map((a) => a.id)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('reads the weekday and the worker from the Prague date, not the UTC one', () => {
    const rows = buildOverview({ activities, services, appointments, previews, offered, filter: everybody });
    const basic = rows.find((r) => r.activityId === 'a-basic');

    /* Two on Tuesday (2), one just after midnight on Wednesday (3). */
    expect(basic?.byWeekday).toEqual([0, 0, 2, 1, 0, 0, 0]);
    expect(basic?.byWorker).toEqual([
      { worker: { id: 'u-novak', name: 'MUDr. Novák' }, count: 2 },
      { worker: { id: 'u-dvorakova', name: 'MUDr. Dvořáková' }, count: 1 },
    ]);
  });

  it('counts free starts and the days they fall on, per calendar', () => {
    const rows = buildOverview({ activities, services, appointments, previews, offered, filter: everybody });
    const basic = rows.find((r) => r.activityId === 'a-basic');

    expect(basic?.freeStarts).toBe(3);
    expect(basic?.freeDates).toEqual(['2026-10-06', '2026-10-07']);
    expect(basic?.freeByCalendar).toEqual([{ calendarId: 'c1', starts: 3, dates: ['2026-10-06', '2026-10-07'] }]);
  });

  it('keeps a row for an činnost that is offered and not yet booked - that row IS the free capacity', () => {
    const rows = buildOverview({ activities, services, appointments, previews, offered, filter: everybody });
    const spiro = rows.find((r) => r.activityId === 'a-spiro');

    expect(spiro).toMatchObject({ booked: 0, freeStarts: 1, freeDates: ['2026-10-07'] });
  });

  it('has no row for an činnost that is neither booked nor offered', () => {
    const rows = buildOverview({
      activities: [...activities, activity('a-idle', 'Nic', 's-diag')],
      services,
      appointments,
      previews,
      offered,
      filter: everybody,
    });

    expect(rows.map((r) => r.activityId)).not.toContain('a-idle');
  });

  it('narrows appointments AND free starts to one worker', () => {
    const rows = buildOverview({
      activities, services, appointments, previews, offered,
      filter: { workerId: 'u-dvorakova', serviceId: null },
    });
    const basic = rows.find((r) => r.activityId === 'a-basic');

    expect(basic).toMatchObject({ booked: 1, cancelled: 1, freeStarts: 1, freeDates: ['2026-10-07'] });
    expect(basic?.appointments.map((a) => a.id)).toEqual(['t3', 't4']);
    /* c2 names nobody, so InBody has nothing of hers. */
    expect(rows.map((r) => r.activityId)).not.toContain('a-inbody');
  });

  it('narrows to one service', () => {
    const rows = buildOverview({
      activities, services, appointments, previews, offered,
      filter: { workerId: null, serviceId: 's-diag' },
    });

    expect(rows.map((r) => r.activityId)).toEqual(['a-inbody']);
  });

  it('still shows an appointment whose činnost the catalogue no longer lists', () => {
    const rows = buildOverview({
      activities,
      services,
      appointments: [appointment('t9', { activityId: 'a-gone', activityName: 'Vyřazená činnost' })],
      previews,
      offered: [],
      filter: everybody,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ activityId: 'a-gone', activityName: 'Vyřazená činnost', activity: null, service: null, booked: 1 });
  });

  it('orders by service, then by činnost, unknown service last', () => {
    const rows = buildOverview({
      activities,
      services,
      appointments: [...appointments, appointment('t9', { activityId: 'a-gone', activityName: 'Vyřazená' })],
      previews,
      offered,
      filter: everybody,
    });

    expect(rows.map((r) => r.activityId)).toEqual(['a-basic', 'a-spiro', 'a-inbody', 'a-gone']);
    expect(groupByService(rows).map((g) => [g.service?.name ?? null, g.rows.length])).toEqual([
      ['Sportovní prohlídky', 2],
      ['Sportovní diagnostika', 1],
      [null, 1],
    ]);
  });

  it('totals booked and starts, and counts a day once however many činnosti are free on it', () => {
    const rows = buildOverview({ activities, services, appointments, previews, offered, filter: everybody });

    expect(overviewTotals(rows)).toEqual({ booked: 3, freeStarts: 4, freeDays: 2 });
  });
});
