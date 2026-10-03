/*
 * Statistiky - the arithmetic (3. 10. 2026).
 *
 * "Statistics for everything, in one place; I choose which - financial,
 * bookings, patients - and see charts that show growth or decline." The
 * backend has no aggregate endpoint yet, so every number on the screen is
 * worked out here from three lists the API already answers: the appointments
 * of a date range (4.5, at most 62 days a call), one page of the register at
 * a time, and the invoices. Pure functions, no React, so each rule has a test
 * and the page only fetches and draws.
 *
 * Dates are Prague calendar days (`yyyy-MM-dd`), never JavaScript `Date`
 * arithmetic on instants: a bucket is a run of days, and an appointment
 * belongs to the day it happens on in Prague, which is what the desk means.
 */
import type { ChipTone } from '../../components/ui';
import { addDaysToDateOnly, pragueDateKey, type DateOnly } from '../../utils/time';

/* ── Periods ── */

export type PeriodKey = 'thisMonth' | 'lastMonth' | 'last90' | 'thisYear' | 'custom';
export type Grouping = 'day' | 'week' | 'month';

export interface Period {
  from: DateOnly;
  to: DateOnly;
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'thisMonth', label: 'Tento měsíc' },
  { key: 'lastMonth', label: 'Minulý měsíc' },
  { key: 'last90', label: 'Posledních 90 dní' },
  { key: 'thisYear', label: 'Tento rok' },
  { key: 'custom', label: 'Vlastní od–do' },
];

export const GROUPING_OPTIONS: { key: Grouping; label: string }[] = [
  { key: 'day', label: 'Den' },
  { key: 'week', label: 'Týden' },
  { key: 'month', label: 'Měsíc' },
];

const pad = (n: number): string => String(n).padStart(2, '0');

function split(date: DateOnly): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last day of the month a date lies in. */
export function monthOf(date: DateOnly): Period {
  const [y, m] = split(date);
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
}

/** The period a picker choice means on a given day. `custom` needs its own dates. */
export function periodFor(key: PeriodKey, today: DateOnly, custom?: Period): Period {
  switch (key) {
    case 'thisMonth':
      return monthOf(today);
    case 'lastMonth': {
      const [y, m] = split(today);
      const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
      return monthOf(prev);
    }
    case 'last90':
      return { from: addDaysToDateOnly(today, -89), to: today };
    case 'thisYear': {
      const [y] = split(today);
      return { from: `${y}-01-01`, to: today };
    }
    case 'custom': {
      if (!custom || !isDateOnly(custom.from) || !isDateOnly(custom.to)) return monthOf(today);
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
    }
  }
}

export function isDateOnly(value: unknown): value is DateOnly {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Inclusive number of days. */
export function daysIn(period: Period): number {
  const a = Date.parse(`${period.from}T00:00:00Z`);
  const b = Date.parse(`${period.to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * The period to compare with: the same number of days, ending the day before
 * this one starts. A whole calendar month compares with the whole previous
 * month, so "říjen oproti září" is not thirty-one days against thirty.
 */
export function previousPeriod(period: Period): Period {
  const [fy, fm, fd] = split(period.from);
  const [ty, tm, td] = split(period.to);
  if (fd === 1 && td === daysInMonth(ty, tm) && fy === ty && fm === tm) {
    return monthOf(addDaysToDateOnly(period.from, -1));
  }
  const length = daysIn(period);
  const to = addDaysToDateOnly(period.from, -1);
  return { from: addDaysToDateOnly(to, -(length - 1)), to };
}

export function inPeriod(date: DateOnly, period: Period): boolean {
  return date >= period.from && date <= period.to;
}

/**
 * The range cut at month boundaries, so every piece fits the API's 62-day
 * limit (4.5) and a cached month is reused when the period moves.
 */
export function monthChunks(from: DateOnly, to: DateOnly): Period[] {
  const chunks: Period[] = [];
  let cursor = from;
  while (cursor <= to) {
    const month = monthOf(cursor);
    const end = month.to < to ? month.to : to;
    chunks.push({ from: cursor, to: end });
    cursor = addDaysToDateOnly(end, 1);
  }
  return chunks;
}

/* ── Buckets ── */

export interface Bucket {
  key: string;
  label: string;
  from: DateOnly;
  to: DateOnly;
}

const MONTHS = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** The Monday of the week a date lies in. */
export function mondayOf(date: DateOnly): DateOnly {
  const [y, m, d] = split(date);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysToDateOnly(date, dow === 0 ? -6 : 1 - dow);
}

/** Which bucket a day belongs to: the day, its Monday, or its month. */
export function bucketKeyOf(date: DateOnly, grouping: Grouping): string {
  switch (grouping) {
    case 'day':
      return date;
    case 'week':
      return mondayOf(date);
    case 'month':
      return date.slice(0, 7);
  }
}

function shortDay(date: DateOnly): string {
  const [, m, d] = split(date);
  return `${d}. ${m}.`;
}

/** The buckets a period divides into, in order, each clipped to the period. */
export function bucketsFor(period: Period, grouping: Grouping): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = period.from;
  while (cursor <= period.to) {
    const key = bucketKeyOf(cursor, grouping);
    let end: DateOnly;
    let label: string;
    if (grouping === 'day') {
      end = cursor;
      label = shortDay(cursor);
    } else if (grouping === 'week') {
      end = addDaysToDateOnly(mondayOf(cursor), 6);
      label = `od ${shortDay(mondayOf(cursor))}`;
    } else {
      end = monthOf(cursor).to;
      const [y, m] = split(cursor);
      label = `${MONTHS[m - 1]} ${y}`;
    }
    if (end > period.to) end = period.to;
    buckets.push({ key, label, from: cursor, to: end });
    cursor = addDaysToDateOnly(end, 1);
  }
  return buckets;
}

function indexOf(buckets: readonly Bucket[], date: DateOnly | null): number {
  if (date === null) return -1;
  return buckets.findIndex((b) => date >= b.from && date <= b.to);
}

/** How many items fall into each bucket. Anything outside every bucket is dropped. */
export function countBy<T>(items: readonly T[], buckets: readonly Bucket[], dateOf: (item: T) => DateOnly | null): number[] {
  const counts = buckets.map(() => 0);
  for (const item of items) {
    const i = indexOf(buckets, dateOf(item));
    if (i >= 0) counts[i] += 1;
  }
  return counts;
}

export function sumBy<T>(
  items: readonly T[],
  buckets: readonly Bucket[],
  dateOf: (item: T) => DateOnly | null,
  valueOf: (item: T) => number,
): number[] {
  const sums = buckets.map(() => 0);
  for (const item of items) {
    const i = indexOf(buckets, dateOf(item));
    if (i >= 0) sums[i] += valueOf(item);
  }
  return sums;
}

/* ── Growth or decline ── */

/** Whole-percent change, or null when there is nothing to compare with. */
export function deltaPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** The chip under a KPI: "+12 % oproti minulému období", green up, red down. */
export function deltaLabel(delta: number | null, lowerIsBetter = false): { text: string; tone: ChipTone } {
  if (delta === null) return { text: 'minulé období bez dat', tone: 'grey' };
  if (delta === 0) return { text: '±0 % oproti minulému období', tone: 'grey' };
  const sign = delta > 0 ? '+' : '−';
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  return {
    text: `${sign}${Math.abs(delta).toLocaleString('cs-CZ')} % oproti minulému období`,
    tone: good ? 'green' : 'red',
  };
}

/* ── Appointments ── */

/** The minimum a row needs; `DayAppointment` satisfies it. */
export interface AppointmentLike {
  id: string;
  startUtc: string;
  status: number;
  activityName: string;
  calendarId?: string | null;
  patientId: string;
}

export const dayOfAppointment = (a: { startUtc: string }): DateOnly => pragueDateKey(a.startUtc);

/**
 * The five columns of the status chart. `CheckedIn` and `Completed` are one
 * column - the visit happened - the same grouping the day overview's
 * "arrived" tally uses (4.5).
 */
export const STATUS_GROUPS = [
  { key: 'booked', label: 'Objednáno', statuses: [0] },
  { key: 'confirmed', label: 'Potvrzeno', statuses: [1] },
  { key: 'done', label: 'Dokončeno', statuses: [2, 3] },
  { key: 'cancelled', label: 'Zrušeno', statuses: [4] },
  { key: 'noShow', label: 'Nepřišel', statuses: [5] },
] as const;
export type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key'];

export function statusGroupOf(status: number): StatusGroupKey | 'other' {
  return STATUS_GROUPS.find((g) => (g.statuses as readonly number[]).includes(status))?.key ?? 'other';
}

export type StatusCounts = Record<StatusGroupKey | 'other', number>;

export interface AppointmentBucketRow extends StatusCounts {
  key: string;
  label: string;
  total: number;
}

const emptyStatusCounts = (): StatusCounts => ({ booked: 0, confirmed: 0, done: 0, cancelled: 0, noShow: 0, other: 0 });

/** Per bucket: every appointment, and how many of each status. */
export function appointmentsPerBucket(appointments: readonly AppointmentLike[], buckets: readonly Bucket[]): AppointmentBucketRow[] {
  const rows = buckets.map<AppointmentBucketRow>((b) => ({ key: b.key, label: b.label, total: 0, ...emptyStatusCounts() }));
  for (const a of appointments) {
    const i = indexOf(buckets, dayOfAppointment(a));
    if (i < 0) continue;
    rows[i].total += 1;
    rows[i][statusGroupOf(a.status)] += 1;
  }
  return rows;
}

export const isCancelled = (a: { status: number }): boolean => a.status === 4;

export interface NamedCount {
  label: string;
  count: number;
}

/** The most frequent values of a key, biggest first, at most `top`. */
export function topCounts<T>(items: readonly T[], labelOf: (item: T) => string, top = 8): NamedCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = labelOf(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'cs'))
    .slice(0, top);
}

/** Appointments by činnost, cancellations left out - a cancelled visit is not work done. */
export function byActivity(appointments: readonly AppointmentLike[], top = 8): NamedCount[] {
  return topCounts(appointments.filter((a) => !isCancelled(a)), (a) => a.activityName || 'Bez činnosti', top);
}

/** Appointments by calendar, named through the calendar list; an unknown id keeps its id. */
export function byCalendar(
  appointments: readonly AppointmentLike[],
  calendars: readonly { id: string; name: string }[],
): NamedCount[] {
  const names = new Map(calendars.map((c) => [c.id, c.name]));
  return topCounts(
    appointments.filter((a) => !isCancelled(a)),
    (a) => (a.calendarId ? names.get(a.calendarId) ?? a.calendarId : 'Bez kalendáře'),
    100,
  );
}

/* ── Patients ── */

export interface PatientLike {
  id: string;
  createdAtUtc: string;
}

export const dayOfRegistration = (p: { createdAtUtc: string }): DateOnly | null =>
  p.createdAtUtc ? pragueDateKey(p.createdAtUtc) : null;

export function newPatientsPerBucket(patients: readonly PatientLike[], buckets: readonly Bucket[]): number[] {
  return countBy(patients, buckets, dayOfRegistration);
}

/** How big the register was at the end of each bucket. */
export function cumulativeRegister(patients: readonly PatientLike[], buckets: readonly Bucket[]): number[] {
  const days = patients.map(dayOfRegistration).filter((d): d is DateOnly => d !== null);
  return buckets.map((b) => days.filter((d) => d <= b.to).length);
}

export interface NewVsReturning {
  /** Patients seen in the period who registered inside it. */
  newPatients: number;
  /** Patients seen in the period who were on the register before it. */
  returning: number;
  /** Patients seen whose register entry is not in the list we hold. */
  unknown: number;
}

/**
 * Of the patients with a visit in the period (cancellations left out), who
 * is new and who came back. Distinct patients, not visits.
 */
export function newVsReturning(
  appointments: readonly AppointmentLike[],
  patients: readonly PatientLike[],
  period: Period,
): NewVsReturning {
  const registered = new Map(patients.map((p) => [p.id, dayOfRegistration(p)]));
  const seen = new Set(
    appointments
      .filter((a) => !isCancelled(a) && a.patientId !== '' && inPeriod(dayOfAppointment(a), period))
      .map((a) => a.patientId),
  );
  const result: NewVsReturning = { newPatients: 0, returning: 0, unknown: 0 };
  for (const id of seen) {
    const day = registered.get(id);
    if (day === undefined || day === null) result.unknown += 1;
    else if (inPeriod(day, period)) result.newPatients += 1;
    else result.returning += 1;
  }
  return result;
}

/* ── Finance ── */

export interface InvoiceLike {
  issueDateUtc: string;
  status: string;
  totalCzk: number;
  paidCzk: number;
  remainingCzk: number;
  items?: readonly { description: string; amountCzk: number }[];
}

export const dayOfInvoice = (inv: { issueDateUtc: string }): DateOnly | null =>
  inv.issueDateUtc ? pragueDateKey(inv.issueDateUtc) : null;

/** Counts towards turnover: issued and not taken back (the same rule as Fakturace). */
export function countsTowardsTurnover(inv: { status: string }): boolean {
  return inv.status === 'Issued' || inv.status === 'PartiallyPaid' || inv.status === 'Paid';
}

/** Still collectable. */
export function isOpenInvoice(inv: InvoiceLike): boolean {
  return (inv.status === 'Issued' || inv.status === 'PartiallyPaid') && inv.remainingCzk > 0;
}

export interface FinanceBucketRow {
  key: string;
  label: string;
  invoiced: number;
  paid: number;
}

export function financePerBucket(invoices: readonly InvoiceLike[], buckets: readonly Bucket[]): FinanceBucketRow[] {
  const counted = invoices.filter(countsTowardsTurnover);
  const invoiced = sumBy(counted, buckets, dayOfInvoice, (i) => i.totalCzk);
  const paid = sumBy(counted, buckets, dayOfInvoice, (i) => i.paidCzk);
  return buckets.map((b, i) => ({ key: b.key, label: b.label, invoiced: invoiced[i], paid: paid[i] }));
}

export function invoicesIn(invoices: readonly InvoiceLike[], period: Period): InvoiceLike[] {
  return invoices.filter((inv) => {
    const day = dayOfInvoice(inv);
    return day !== null && inPeriod(day, period);
  });
}

export function invoicedTotal(invoices: readonly InvoiceLike[]): number {
  return invoices.filter(countsTowardsTurnover).reduce((n, i) => n + i.totalCzk, 0);
}

export function paidTotal(invoices: readonly InvoiceLike[]): number {
  return invoices.filter(countsTowardsTurnover).reduce((n, i) => n + i.paidCzk, 0);
}

export function unpaidTotal(invoices: readonly InvoiceLike[]): number {
  return invoices.filter(isOpenInvoice).reduce((n, i) => n + i.remainingCzk, 0);
}

/** Invoiced per counted invoice - what a visit brings in on average; null with no invoices. */
export function averagePerInvoice(invoices: readonly InvoiceLike[]): number | null {
  const counted = invoices.filter(countsTowardsTurnover);
  if (counted.length === 0) return null;
  return invoicedTotal(counted) / counted.length;
}

export interface NamedAmount {
  label: string;
  amount: number;
}

/** Turnover by line item, biggest first - the činnosti money comes from. */
export function revenueByItem(invoices: readonly InvoiceLike[], top = 8): NamedAmount[] {
  const sums = new Map<string, number>();
  for (const inv of invoices.filter(countsTowardsTurnover)) {
    for (const item of inv.items ?? []) {
      const label = item.description || 'Bez popisu';
      sums.set(label, (sums.get(label) ?? 0) + item.amountCzk);
    }
  }
  return [...sums.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, 'cs'))
    .slice(0, top);
}

/* ── Formatting and CSV ── */

/** "2 200 Kč" - the board writes money with a thin space and no decimals. */
export function formatCzk(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('cs-CZ');
}

/** "3. 10. 2026" from a date-only value. */
export function formatPeriod(period: Period): string {
  const f = (d: DateOnly) => {
    const [y, m, day] = split(d);
    return `${day}. ${m}. ${y}`;
  };
  return period.from === period.to ? f(period.from) : `${f(period.from)} – ${f(period.to)}`;
}

export type CsvCell = string | number | null | undefined;

/**
 * A CSV the Czech Excel opens as a table: semicolons, a decimal comma, CRLF
 * line ends and a BOM so the diacritics survive. Cells with a separator, a
 * quote or a line break are quoted; a quote inside is doubled.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const cell = (v: CsvCell): string => {
    if (v === null || v === undefined) return '';
    const text = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header, ...rows].map((r) => r.map(cell).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** `statistiky-objednavky-2026-10-01_2026-10-31.csv` */
export function csvFileName(section: string, period: Period): string {
  const slug = section
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `statistiky-${slug}-${period.from}_${period.to}.csv`;
}
