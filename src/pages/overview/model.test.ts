/*
 * Přehled's five questions, as pure functions: the day, what needs a person, the week, the clubs. The states that matter
 * (loading, failed, empty, ready) are pinned here, above all that a failed source is NEVER an all-clear.
 */
import { describe, it, expect } from 'vitest';
import type { DayAppointment } from '../../api/bookingContracts';
import type { AttentionGroup, ClubOrderLike } from '../../ui/shelf/attention';
import { MAX_ROWS, attentionBlock, clubsBlock, mondayOf, statusOf, todayBlock, weekBlock, weekRange } from './model';

/* Thursday 22. 10. 2026, 12:00 in Prague (UTC+2 in summer time). */
const NOW = new Date('2026-10-22T10:00:00Z');

/** Status codes as the contract numbers them: 0 Scheduled, 1 Confirmed, 2 CheckedIn, 3 Completed, 4 Cancelled, 5 NoShow. */
const appt = (id: string, startUtc: string, status: number, patientId = 'p1', name: string | null = null): DayAppointment => {
  const end = new Date(Date.parse(startUtc) + 30 * 60_000).toISOString();
  return {
    id, calendarId: 'c1', patientId, activityId: 'a1', activityName: 'Kontrola', startUtc, endUtc: end, status,
    isRunningLate: false, checkedInUtc: null, paperwork: null, patientName: name,
  } as DayAppointment;
};

const names = (a: DayAppointment) => a.patientName ?? `Pacient ${a.patientId}`;

describe('statusOf', () => {
  it('is ready only when the source has data, failed when it errored without data, loading otherwise', () => {
    expect(statusOf({ data: [], isPending: false, isError: false })).toBe('ready');
    expect(statusOf({ data: undefined, isPending: true, isError: false })).toBe('loading');
    expect(statusOf({ data: undefined, isPending: false, isError: true })).toBe('error');
    /* A refetch that failed keeps showing the last good answer. */
    expect(statusOf({ data: [], isPending: false, isError: true })).toBe('ready');
  });
});

describe('1. Dnes', () => {
  const week = [
    appt('done', '2026-10-22T06:00:00Z', 3, 'p1', 'Hotová'),
    appt('wait2', '2026-10-22T08:00:00Z', 2, 'p2', 'Čekající Druhý'),
    appt('wait1', '2026-10-22T07:30:00Z', 2, 'p3', 'Čekající První'),
    appt('soon', '2026-10-22T11:00:00Z', 1, 'p4', 'Další Pacient'),
    appt('later', '2026-10-22T13:00:00Z', 0, 'p5', 'Pozdější'),
    appt('cancelled', '2026-10-22T09:00:00Z', 4, 'p6', 'Zrušený'),
    appt('noshow', '2026-10-22T09:30:00Z', 5, 'p7', 'Nepřišel'),
    appt('yesterday', '2026-10-21T09:00:00Z', 1, 'p8', 'Včera'),
    appt('tomorrow', '2026-10-23T09:00:00Z', 1, 'p9', 'Zítra'),
  ];

  it('counts what stands or happened today: not a cancellation, not a no-show, not another day', () => {
    const b = todayBlock('ready', week, NOW, names);
    expect(b.total).toBe(5);
  });

  it('names who is next: the first booked visit that has not ended, with its Prague time', () => {
    const b = todayBlock('ready', week, NOW, names);
    expect(b.next).toMatchObject({ id: 'soon', time: '13:00', name: 'Další Pacient', patientId: 'p4' });
  });

  it('lists who waits now (CheckedIn only), longest waiting first - a completed visit is not in the waiting room', () => {
    const b = todayBlock('ready', week, NOW, names);
    expect(b.waiting.map((p) => p.id)).toEqual(['wait1', 'wait2']);
    expect(b.waiting.map((p) => p.time)).toEqual(['09:30', '10:00']);
  });

  it('has nobody next once the booked visits are over, and says so (null) instead of inventing one', () => {
    const late = new Date('2026-10-22T20:00:00Z');
    expect(todayBlock('ready', week, late, names).next).toBeNull();
  });

  it('draws a slot with no register entry as a name that is not a link', () => {
    const b = todayBlock('ready', [appt('walk', '2026-10-22T11:00:00Z', 0, '', 'Host bez karty')], NOW, names, () => false);
    expect(b.next).toMatchObject({ name: 'Host bez karty', patientId: '' });
  });

  it('an empty day is ready with zero - the source answered', () => {
    const b = todayBlock('ready', [], NOW, names);
    expect(b).toMatchObject({ status: 'ready', total: 0, next: null, waiting: [] });
  });

  it('a failed or pending source is carried through as such, never as zero bookings that look real', () => {
    expect(todayBlock('error', undefined, NOW, names).status).toBe('error');
    expect(todayBlock('loading', undefined, NOW, names).status).toBe('loading');
    /* Even with rows around, a non-ready status shows no figures. */
    expect(todayBlock('error', week, NOW, names)).toMatchObject({ total: 0, next: null, waiting: [] });
  });
});

describe('3. Tento týden', () => {
  it('finds the Monday of a Prague week, Sunday included', () => {
    expect(mondayOf('2026-10-22')).toBe('2026-10-19');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(weekRange(NOW)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('has exactly seven bars, Po to Ne, today marked once', () => {
    const w = weekBlock('ready', [], NOW);
    expect(w.days.map((d) => d.label)).toEqual(['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']);
    expect(w.days.filter((d) => d.today).map((d) => d.label)).toEqual(['Čt']);
  });

  it('counts per Prague day and leaves cancellations and no-shows out', () => {
    const rows = [
      appt('a', '2026-10-19T08:00:00Z', 3), appt('b', '2026-10-19T09:00:00Z', 3), appt('c', '2026-10-19T10:00:00Z', 4),
      appt('d', '2026-10-22T08:00:00Z', 1), appt('e', '2026-10-22T09:00:00Z', 5),
      /* 23:30 Prague on Sunday is still Sunday (21:30Z). */
      appt('f', '2026-10-25T21:30:00Z', 0),
      /* Outside the week. */
      appt('g', '2026-10-26T08:00:00Z', 0),
    ];
    const w = weekBlock('ready', rows, NOW);
    expect(w.days.map((d) => d.count)).toEqual([2, 0, 0, 1, 0, 0, 1]);
    expect(w.total).toBe(4);
    expect(w.max).toBe(2);
  });

  it('keeps max at 1 on an empty week, so a bar height is never a division by zero', () => {
    expect(weekBlock('ready', [], NOW).max).toBe(1);
  });

  it('a failed week shows no counts at all, only its status', () => {
    const w = weekBlock('error', [appt('a', '2026-10-19T08:00:00Z', 3)], NOW);
    expect(w.status).toBe('error');
    expect(w.total).toBe(0);
  });
});

const group = (id: AttentionGroup['id'], count: number, title = id as string): AttentionGroup => ({
  id, severity: 'high', title, count,
  items: [
    { id: `${id}-1`, title: 'První', detail: 'detail 1', to: '/x' },
    { id: `${id}-2`, title: 'Druhý', detail: '', to: '/x' },
    { id: `${id}-3`, title: 'Třetí', detail: 'detail 3', to: '/x' },
    { id: `${id}-4`, title: 'Čtvrtý', detail: 'detail 4', to: '/x' },
  ],
  summary: `Shrnutí ${id}`,
  action: { label: 'Otevřít', to: `/${id}` },
});

describe('2. Vyžaduje pozornost', () => {
  it('shows the top three groups only; the rest is in `rest` for the pop-out', () => {
    const groups = [group('overdueInvoices', 4), group('paperworkToday', 2), group('expiringDocuments', 7), group('intakeReviews', 1), group('failedMessages', 3)];
    const b = attentionBlock({ groups, loading: false, failed: 0 });
    expect(b.rows.map((r) => r.id)).toEqual(['overdueInvoices', 'paperworkToday', 'expiringDocuments']);
    expect(b.rows).toHaveLength(MAX_ROWS);
    expect(b.rest.map((r) => r.id)).toEqual(['intakeReviews', 'failedMessages']);
  });

  it('does not repeat the clubs here: they have their own block', () => {
    const b = attentionBlock({ groups: [group('clubInquiries', 5), group('paperworkToday', 2)], loading: false, failed: 0 });
    expect(b.rows.map((r) => r.id)).toEqual(['paperworkToday']);
    expect(b.total).toBe(2);
  });

  it('a row carries where it is fixed, the sentence for its pop-out and at most three cases', () => {
    const [row] = attentionBlock({ groups: [group('overdueInvoices', 4)], loading: false, failed: 0 }).rows;
    expect(row).toMatchObject({ to: '/overdueInvoices', summary: 'Shrnutí overdueInvoices', count: 4 });
    expect(row.cases).toEqual(['První - detail 1', 'Druhý', 'Třetí - detail 3']);
  });

  it('nothing to say and every source answered: ready and empty (the block collapses to "vše vyřízeno")', () => {
    expect(attentionBlock({ groups: [], loading: false, failed: 0 })).toMatchObject({ status: 'ready', rows: [], rest: [], total: 0 });
  });

  it('NEVER an all-clear when a source failed and nothing was found: that is an error', () => {
    const b = attentionBlock({ groups: [], loading: false, failed: 2 });
    expect(b.status).toBe('error');
    expect(b.unreadable).toBe(2);
  });

  it('keeps what was found when only some sources failed, and says how many could not be read', () => {
    const b = attentionBlock({ groups: [group('overdueInvoices', 1)], loading: false, failed: 1 });
    expect(b.status).toBe('ready');
    expect(b.rows).toHaveLength(1);
    expect(b.unreadable).toBe(1);
  });

  it('is loading while the sources are on their way', () => {
    expect(attentionBlock({ groups: [], loading: true, failed: 0 }).status).toBe('loading');
  });
});

const order = (id: string, club: string, seats: number, submitted: string | null, status = 'Requested'): ClubOrderLike => ({
  id, clubId: `club-${id}`, clubName: club, status, totalSeats: seats, submittedAtUtc: submitted,
});

describe('4. Kluby k vyřízení', () => {
  const orders = [
    order('o3', 'SK Třetí', 9, '2026-10-21T08:00:00Z'),
    order('o1', 'FK První', 14, '2026-10-18T08:00:00Z'),
    order('o4', 'FC Čtvrtý', 12, '2026-10-22T08:00:00Z'),
    order('o2', 'TJ Druhý', 22, '2026-10-20T08:00:00Z'),
    order('done', 'Hotový klub', 5, '2026-10-01T08:00:00Z', 'Confirmed'),
  ];

  it('counts the requests nobody answered and shows the oldest three, each a link to the order', () => {
    const b = clubsBlock('ready', orders);
    expect(b.count).toBe(4);
    expect(b.rows.map((r) => r.id)).toEqual(['o1', 'o2', 'o3']);
    expect(b.more).toBe(1);
    expect(b.rows[0]).toMatchObject({ clubName: 'FK První', seats: 14, since: '2026-10-18', to: '/clubs/objednavky', state: { openOrderId: 'o1' } });
  });

  it('an answered source with nothing waiting is ready with zero (the block collapses)', () => {
    expect(clubsBlock('ready', [order('x', 'K', 1, null, 'Confirmed')])).toMatchObject({ status: 'ready', count: 0, rows: [] });
  });

  it('a failed or pending source is never "žádná poptávka"', () => {
    expect(clubsBlock('error', undefined)).toMatchObject({ status: 'error', count: 0 });
    expect(clubsBlock('loading', undefined)).toMatchObject({ status: 'loading', count: 0 });
  });

  it('an order with no submit time still lists, without a date', () => {
    expect(clubsBlock('ready', [order('n', 'Bez data', 3, null)]).rows[0].since).toBeNull();
  });
});
