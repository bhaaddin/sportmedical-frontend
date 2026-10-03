/*
 * Statistiky - the arithmetic, broken one rule at a time: which days a period
 * covers and what it compares with, how days fall into buckets, how
 * appointments, patients and invoices are counted, and what the CSV looks like.
 */
import { describe, expect, it } from 'vitest';
import {
  appointmentsPerBucket,
  averagePerInvoice,
  bucketKeyOf,
  bucketsFor,
  byActivity,
  byCalendar,
  csvFileName,
  cumulativeRegister,
  daysIn,
  deltaLabel,
  deltaPercent,
  financePerBucket,
  invoicesIn,
  monthChunks,
  newPatientsPerBucket,
  newVsReturning,
  periodFor,
  previousPeriod,
  revenueByItem,
  toCsv,
  unpaidTotal,
} from './aggregate';

const today = '2026-10-03';

describe('periods', () => {
  it('knows the picker choices on a given day', () => {
    expect(periodFor('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodFor('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodFor('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodFor('last90', today)).toEqual({ from: '2026-07-06', to: '2026-10-03' });
    expect(periodFor('thisYear', today)).toEqual({ from: '2026-01-01', to: '2026-10-03' });
  });

  it('takes a custom range, puts it the right way round, and falls back to the month for nonsense', () => {
    expect(periodFor('custom', today, { from: '2026-10-20', to: '2026-10-05' })).toEqual({ from: '2026-10-05', to: '2026-10-20' });
    expect(periodFor('custom', today, { from: 'x', to: '2026-10-05' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('compares a whole month with the whole month before, and anything else with the same number of days', () => {
    expect(previousPeriod({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(previousPeriod({ from: '2026-10-01', to: '2026-10-03' })).toEqual({ from: '2026-09-28', to: '2026-09-30' });
    expect(daysIn({ from: '2026-10-01', to: '2026-10-03' })).toBe(3);
  });

  it('cuts a range at month ends so no request asks for more than the API allows', () => {
    const chunks = monthChunks('2026-08-15', '2026-10-03');
    expect(chunks).toEqual([
      { from: '2026-08-15', to: '2026-08-31' },
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-10-03' },
    ]);
    expect(chunks.every((c) => daysIn(c) <= 62)).toBe(true);
    expect(monthChunks('2026-10-01', '2026-10-31')).toEqual([{ from: '2026-10-01', to: '2026-10-31' }]);
  });
});

describe('buckets', () => {
  it('keys a day by itself, by its Monday, or by its month', () => {
    expect(bucketKeyOf('2026-10-03', 'day')).toBe('2026-10-03');
    /* 3. 10. 2026 is a Saturday; 4. 10. a Sunday - both belong to Monday 28. 9. */
    expect(bucketKeyOf('2026-10-03', 'week')).toBe('2026-09-28');
    expect(bucketKeyOf('2026-10-04', 'week')).toBe('2026-09-28');
    expect(bucketKeyOf('2026-10-05', 'week')).toBe('2026-10-05');
    expect(bucketKeyOf('2026-10-03', 'month')).toBe('2026-10');
  });

  it('divides a period into labelled buckets clipped to its edges', () => {
    const weeks = bucketsFor({ from: '2026-10-01', to: '2026-10-12' }, 'week');
    expect(weeks).toEqual([
      { key: '2026-09-28', label: 'od 28. 9.', from: '2026-10-01', to: '2026-10-04' },
      { key: '2026-10-05', label: 'od 5. 10.', from: '2026-10-05', to: '2026-10-11' },
      { key: '2026-10-12', label: 'od 12. 10.', from: '2026-10-12', to: '2026-10-12' },
    ]);
    const months = bucketsFor({ from: '2026-08-15', to: '2026-10-03' }, 'month');
    expect(months.map((b) => b.label)).toEqual(['srpen 2026', 'září 2026', 'říjen 2026']);
    expect(bucketsFor({ from: '2026-10-01', to: '2026-10-02' }, 'day').map((b) => b.label)).toEqual(['1. 10.', '2. 10.']);
  });
});

describe('growth or decline', () => {
  it('is a whole percent, or nothing when the previous period had nothing', () => {
    expect(deltaPercent(112, 100)).toBe(12);
    expect(deltaPercent(90, 100)).toBe(-10);
    expect(deltaPercent(5, 0)).toBeNull();
  });

  it('is green up and red down - unless less is better, as with unpaid money', () => {
    expect(deltaLabel(12)).toEqual({ text: '+12 % oproti minulému období', tone: 'green' });
    expect(deltaLabel(-8)).toEqual({ text: '−8 % oproti minulému období', tone: 'red' });
    expect(deltaLabel(-8, true)).toEqual({ text: '−8 % oproti minulému období', tone: 'green' });
    expect(deltaLabel(0)).toEqual({ text: '±0 % oproti minulému období', tone: 'grey' });
    expect(deltaLabel(null)).toEqual({ text: 'minulé období bez dat', tone: 'grey' });
  });
});

const appt = (id: string, startUtc: string, status: number, activityName = 'Základní prohlídka', calendarId = 'c-1', patientId = 'p-1') => ({
  id, startUtc, status, activityName, calendarId, patientId,
});

const appointments = [
  appt('1', '2026-10-01T08:00:00Z', 0),
  appt('2', '2026-10-01T09:00:00Z', 3, 'Komplexní prohlídka', 'c-2', 'p-2'),
  appt('3', '2026-10-02T08:00:00Z', 4),
  appt('4', '2026-10-02T22:30:00Z', 2), // 00:30 on 3. 10. in Prague
  appt('5', '2026-10-05T08:00:00Z', 5, 'Komplexní prohlídka', 'c-2', 'p-3'),
  appt('6', '2026-09-30T08:00:00Z', 3), // before the period
];

describe('appointments', () => {
  const buckets = bucketsFor({ from: '2026-10-01', to: '2026-10-05' }, 'day');

  it('counts each bucket by the Prague day and by status group', () => {
    const rows = appointmentsPerBucket(appointments, buckets);
    expect(rows.map((r) => r.total)).toEqual([2, 1, 1, 0, 1]);
    expect(rows[0]).toMatchObject({ booked: 1, done: 1, cancelled: 0 });
    expect(rows[1]).toMatchObject({ cancelled: 1 });
    expect(rows[2]).toMatchObject({ done: 1 }); // CheckedIn counts as the visit happening
    expect(rows[4]).toMatchObject({ noShow: 1 });
  });

  it('ranks činnosti and calendars without the cancellations', () => {
    expect(byActivity(appointments)).toEqual([
      { label: 'Komplexní prohlídka', count: 2 },
      { label: 'Základní prohlídka', count: 3 },
    ].sort((a, b) => b.count - a.count));
    expect(byCalendar(appointments, [{ id: 'c-1', name: 'Prohlídky' }])).toEqual([
      { label: 'Prohlídky', count: 3 },
      { label: 'c-2', count: 2 },
    ]);
  });
});

describe('patients', () => {
  const patients = [
    { id: 'p-1', createdAtUtc: '2026-03-01T10:00:00Z' },
    { id: 'p-2', createdAtUtc: '2026-10-01T10:00:00Z' },
    { id: 'p-3', createdAtUtc: '2026-10-04T10:00:00Z' },
  ];
  const period = { from: '2026-10-01', to: '2026-10-05' };
  const buckets = bucketsFor(period, 'day');

  it('counts registrations per bucket and the register size at each bucket end', () => {
    expect(newPatientsPerBucket(patients, buckets)).toEqual([1, 0, 0, 1, 0]);
    expect(cumulativeRegister(patients, buckets)).toEqual([2, 2, 2, 3, 3]);
  });

  it('tells new from returning among the patients seen, once each, cancellations aside', () => {
    expect(newVsReturning(appointments, patients, period)).toEqual({ newPatients: 2, returning: 1, unknown: 0 });
    expect(newVsReturning(appointments, patients.slice(0, 1), period)).toEqual({ newPatients: 0, returning: 1, unknown: 2 });
  });
});

describe('finance', () => {
  const invoices = [
    { issueDateUtc: '2026-10-01T10:00:00Z', status: 'Paid', totalCzk: 1600, paidCzk: 1600, remainingCzk: 0, items: [{ description: 'Základní prohlídka', amountCzk: 1600 }] },
    { issueDateUtc: '2026-10-02T10:00:00Z', status: 'Issued', totalCzk: 2200, paidCzk: 0, remainingCzk: 2200, items: [{ description: 'Komplexní prohlídka', amountCzk: 2200 }] },
    { issueDateUtc: '2026-10-02T11:00:00Z', status: 'PartiallyPaid', totalCzk: 2200, paidCzk: 1000, remainingCzk: 1200, items: [{ description: 'Komplexní prohlídka', amountCzk: 2200 }] },
    { issueDateUtc: '2026-10-03T10:00:00Z', status: 'Cancelled', totalCzk: 9999, paidCzk: 0, remainingCzk: 9999, items: [] },
    { issueDateUtc: '2026-09-20T10:00:00Z', status: 'Paid', totalCzk: 500, paidCzk: 500, remainingCzk: 0, items: [] },
  ];
  const period = { from: '2026-10-01', to: '2026-10-05' };

  it('sums what was invoiced and what came in per bucket, cancelled documents aside', () => {
    const rows = financePerBucket(invoices, bucketsFor(period, 'day'));
    expect(rows.map((r) => r.invoiced)).toEqual([1600, 4400, 0, 0, 0]);
    expect(rows.map((r) => r.paid)).toEqual([1600, 1000, 0, 0, 0]);
  });

  it('knows what is still owed and what a visit brings in on average', () => {
    const inPeriod = invoicesIn(invoices, period);
    expect(inPeriod).toHaveLength(4);
    expect(unpaidTotal(inPeriod)).toBe(3400);
    expect(averagePerInvoice(inPeriod)).toBe(2000);
    expect(averagePerInvoice([])).toBeNull();
  });

  it('ranks the činnosti the money comes from', () => {
    expect(revenueByItem(invoicesIn(invoices, period))).toEqual([
      { label: 'Komplexní prohlídka', amount: 4400 },
      { label: 'Základní prohlídka', amount: 1600 },
    ]);
  });
});

describe('CSV', () => {
  it('writes semicolons, decimal commas, CRLF and a BOM, and quotes what needs it', () => {
    const csv = toCsv(['Období', 'Částka', 'Pozn.'], [['1. 10.', 1600.5, 'a; b'], ['2. 10.', 0, 'říká "ne"']]);
    expect(csv).toBe('﻿Období;Částka;Pozn.\r\n1. 10.;1600,5;"a; b"\r\n2. 10.;0;"říká ""ne"""\r\n');
  });

  it('names the file after the section and the period, without diacritics', () => {
    expect(csvFileName('Podle činnosti', { from: '2026-10-01', to: '2026-10-31' })).toBe('statistiky-podle-cinnosti-2026-10-01_2026-10-31.csv');
  });
});
