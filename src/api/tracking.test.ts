import { describe, it, expect } from 'vitest';
import {
  clinicWeekdayHour,
  presetRange,
  rowCountsFor,
  rowsForCell,
  share,
  statusCodeOfKey,
  trackingPeriodSchema,
  type TrackingRow,
} from './tracking';

const row = (over: Partial<TrackingRow>): TrackingRow => ({
  appointmentId: over.appointmentId ?? Math.random().toString(36).slice(2),
  calendarId: 'c1',
  calendarName: 'Ordinace 1',
  patientId: 'p1',
  patientName: 'Anna Nováková',
  activityId: 'a1',
  activityName: 'Základní prohlídka',
  serviceId: 's1',
  serviceName: 'Sportovní prohlídky',
  workerUserId: 'u1',
  workerName: 'MUDr. Novák',
  startUtc: '2026-09-24T07:00:00Z',
  endUtc: '2026-09-24T07:30:00Z',
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paid: false,
  questionnaireMissing: false,
  newPatient: false,
  ...over,
});

describe('period presets', () => {
  it('today is one day', () => {
    expect(presetRange('today', '2026-09-24')).toEqual({ from: '2026-09-24', to: '2026-09-24' });
  });

  it('the week runs Monday to Sunday around a Thursday', () => {
    expect(presetRange('week', '2026-09-24')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });

  it('a Sunday belongs to the week that ends on it, not the one that starts after it', () => {
    expect(presetRange('week', '2026-09-27')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });

  it('the month runs from the first to its last day, February included', () => {
    expect(presetRange('month', '2026-09-24')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('the clinic clock', () => {
  it('reads 07:00Z in September as Thursday 09:00 in Prague', () => {
    expect(clinicWeekdayHour('2026-09-24T07:00:00Z')).toEqual({ dayOfWeek: 4, hour: 9, day: '2026-09-24' });
  });

  it('puts 23:30Z on the next Prague day', () => {
    expect(clinicWeekdayHour('2026-09-24T23:30:00Z').day).toBe('2026-09-25');
  });
});

describe('which tally a row belongs to', () => {
  it('follows the server definitions, not the status name', () => {
    expect(rowCountsFor(row({ status: 4, paid: true }), 'paid')).toBe(false);
    expect(rowCountsFor(row({ status: 2, paid: true }), 'paid')).toBe(true);
    expect(rowCountsFor(row({ status: 3 }), 'arrived')).toBe(true);
    expect(rowCountsFor(row({ status: 4 }), 'booked')).toBe(false);
    expect(rowCountsFor(row({ questionnaireMissing: null }), 'questionnaireMissing')).toBe(false);
    expect(rowCountsFor(row({ newPatient: true }), 'returningPatients')).toBe(false);
  });
});

describe('the list behind a cell', () => {
  const rows = [
    row({ appointmentId: 'later', startUtc: '2026-09-24T09:00:00Z', serviceId: 's1', status: 5 }),
    row({ appointmentId: 'first', startUtc: '2026-09-24T07:00:00Z', serviceId: 's1', status: 2, paid: true }),
    row({ appointmentId: 'other', startUtc: '2026-09-25T07:00:00Z', serviceId: 's2', workerUserId: null, status: 0 }),
  ];

  it('filters by service and status and keeps start order', () => {
    expect(rowsForCell(rows, { serviceId: 's1', status: 5 }).map((r) => r.appointmentId)).toEqual(['later']);
    expect(rowsForCell(rows, { serviceId: 's1' }).map((r) => r.appointmentId)).toEqual(['first', 'later']);
  });

  it('a null in the filter means the rows the server left unnamed', () => {
    expect(rowsForCell(rows, { workerUserId: null }).map((r) => r.appointmentId)).toEqual(['other']);
  });

  it('a metric cell is the tally column applied to the rows', () => {
    expect(rowsForCell(rows, { serviceId: 's1', metric: 'paid' }).map((r) => r.appointmentId)).toEqual(['first']);
  });

  it('a heat cell is the clinic weekday and hour', () => {
    expect(rowsForCell(rows, { weekdayHour: { dayOfWeek: 4, hour: 11 } }).map((r) => r.appointmentId)).toEqual(['later']);
    expect(rowsForCell(rows, { day: '2026-09-25' }).map((r) => r.appointmentId)).toEqual(['other']);
  });
});

describe('shares', () => {
  it('never shows 0 % for nothing to divide by', () => {
    expect(share(0, 0)).toBeNull();
    expect(share(1, 4)).toBe(25);
  });
});

describe('the wire', () => {
  it('reads the grouping the server spells as a number', () => {
    const parsed = trackingPeriodSchema.parse({
      from: '2026-09-01',
      to: '2026-09-30',
      groupBy: 2,
      totals: { booked: 0, arrived: 0, noShow: 0, cancelled: 0, completed: 0, paid: 0, questionnaireMissing: 0, newPatients: 0, returningPatients: 0 },
      groups: [],
      workerByService: [],
      heat: [],
      payments: { paidCount: 0, paidAmount: 0, openCount: 0, openAmount: 0 },
      diagnosticSessions: 0,
      rows: [],
      workers: [],
    });
    expect(parsed.groupBy).toBe('worker');
    expect(statusCodeOfKey('NoShow')).toBe(5);
    expect(statusCodeOfKey('2026-09-01')).toBeNull();
  });
});
