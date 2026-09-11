/*
 * The bell's list arithmetic: time, day headings, grouping, and the new/seen
 * line.
 *
 * These are the parts that go wrong invisibly. A group that swallows a row
 * still looks like a tidy list; a divider one position out still looks like a
 * divider; "Před 12 dny" still looks like a timestamp. None of it throws.
 *
 * What would have to break for these to fail: relative time creeping past the
 * hour, grouping keyed on the title instead of `kind`, groups merging across a
 * day or across the new/seen line, sorting by unread, or a boundary drawn when
 * there is nothing on one side of it.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNotificationSections,
  dayHeading,
  exactNotificationTime,
  formatNotificationTime,
  groupLabel,
  newSinceBoundary,
  type NotificationRow,
} from './notificationList';

/* Prague is +2 in September, so 12:00Z is 14:00 on the clock. */
const NOW = new Date('2026-09-11T12:00:00Z');

const row = (
  id: string,
  timestamp: string,
  extra: Partial<NotificationRow> = {},
): NotificationRow => ({
  id,
  type: 'info',
  title: 'Nový termín',
  message: 'Ordinace · Kontrola',
  timestamp,
  read: false,
  ...extra,
});

describe('formatNotificationTime', () => {
  it('is relative only under the hour', () => {
    expect(formatNotificationTime('2026-09-11T11:59:40Z', NOW)).toBe('Právě teď');
    expect(formatNotificationTime('2026-09-11T11:48:00Z', NOW)).toBe('Před 12 min');
    expect(formatNotificationTime('2026-09-11T11:01:00Z', NOW)).toBe('Před 59 min');
  });

  it('becomes a clock time at the hour, in Prague', () => {
    /* 10:32Z is 12:32 in Prague, and 88 minutes earlier - past the hour. */
    expect(formatNotificationTime('2026-09-11T10:32:00Z', NOW)).toBe('12:32');
  });

  it('says Včera for yesterday, with the time', () => {
    expect(formatNotificationTime('2026-09-10T12:32:00Z', NOW)).toBe('Včera 14:32');
  });

  it('gives a date for anything older - never "Před 12 dny" alone', () => {
    const label = formatNotificationTime('2026-08-30T12:32:00Z', NOW);
    expect(label).toBe('30. 8. 14:32');
    expect(label).not.toMatch(/Před/);
  });

  /*
   * The boundary the rule is written on. One minute either side of the hour
   * must land on different sides, or "relative only under the hour" is a
   * sentence in a comment rather than behaviour.
   */
  it('switches sides exactly at the hour', () => {
    expect(formatNotificationTime('2026-09-11T11:00:30Z', NOW)).toBe('Před 59 min');
    expect(formatNotificationTime('2026-09-11T10:59:00Z', NOW)).toBe('12:59');
  });

  it('shows a clock rather than negative minutes when a clock is wrong', () => {
    expect(formatNotificationTime('2026-09-11T12:30:00Z', NOW)).toBe('14:30');
  });

  it('never renders a crash for a broken timestamp', () => {
    expect(formatNotificationTime('not a date', NOW)).toBe('');
  });
});

describe('exactNotificationTime', () => {
  it('is available even for a row whose label is relative', () => {
    expect(exactNotificationTime('2026-09-11T11:48:00Z')).toBe('11. 9. 2026 13:48');
  });
});

describe('dayHeading', () => {
  it('names today and yesterday, and dates the rest', () => {
    expect(dayHeading('2026-09-11T06:00:00Z', NOW)).toBe('Dnes');
    expect(dayHeading('2026-09-10T06:00:00Z', NOW)).toBe('Včera');
    expect(dayHeading('2026-09-09T06:00:00Z', NOW)).toBe('9. 9. 2026');
  });

  /* 22:30Z on the 10th is 00:30 on the 11th in Prague - today, not yesterday. */
  it('buckets by the Prague day, not by UTC', () => {
    expect(dayHeading('2026-09-10T22:30:00Z', NOW)).toBe('Dnes');
  });
});

describe('buildNotificationSections', () => {
  it('orders by time, newest first, and ignores whether a row was read', () => {
    const sections = buildNotificationSections(
      [
        row('old', '2026-09-11T08:00:00Z', { read: false }),
        row('new', '2026-09-11T11:00:00Z', { read: true }),
      ],
      { now: NOW },
    );

    const ids = sections[0].entries.map((e) => (e.entry === 'single' ? e.row.id : e.rows[0].id));
    expect(ids).toEqual(['new', 'old']);
  });

  it('splits into day sections', () => {
    const sections = buildNotificationSections(
      [
        row('a', '2026-09-11T08:00:00Z'),
        row('b', '2026-09-10T08:00:00Z'),
        row('c', '2026-09-08T08:00:00Z'),
      ],
      { now: NOW },
    );

    expect(sections.map((s) => s.heading)).toEqual(['Dnes', 'Včera', '8. 9. 2026']);
  });

  it('merges a run of the same kind into one entry', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(`b${i}`, `2026-09-11T09:${String(i).padStart(2, '0')}:00Z`, {
        kind: 'appointment.booked',
      }),
    );

    const sections = buildNotificationSections(rows, { now: NOW });

    expect(sections[0].entries).toHaveLength(1);
    const group = sections[0].entries[0];
    expect(group.entry).toBe('group');
    if (group.entry === 'group') {
      expect(group.rows).toHaveLength(8);
      expect(group.unreadCount).toBe(8);
      expect(groupLabel(group.kind, group.rows.length)).toBe('8 nových termínů');
    }
  });

  /*
   * The rule that keeps a merged list honest. Something that happened between
   * two bookings happened between them, and a list that hides it is wrong
   * about the order of events - which is the only thing a chronological list
   * is for.
   */
  it('does not merge across a different kind that happened in between', () => {
    const sections = buildNotificationSections(
      [
        row('b1', '2026-09-11T09:00:00Z', { kind: 'appointment.booked' }),
        row('x', '2026-09-11T09:05:00Z', { kind: 'appointment.cancelled' }),
        row('b2', '2026-09-11T09:10:00Z', { kind: 'appointment.booked' }),
      ],
      { now: NOW },
    );

    expect(sections[0].entries).toHaveLength(3);
    expect(sections[0].entries.every((e) => e.entry === 'single')).toBe(true);
  });

  it('never merges across a day heading', () => {
    const sections = buildNotificationSections(
      [
        row('a', '2026-09-11T09:00:00Z', { kind: 'intake.submitted' }),
        row('b', '2026-09-10T09:00:00Z', { kind: 'intake.submitted' }),
      ],
      { now: NOW },
    );

    expect(sections).toHaveLength(2);
    expect(sections.every((s) => s.entries.length === 1)).toBe(true);
  });

  /*
   * An absent kind means "do not group", not "a group of blank ones". Older
   * rows predate the field and inferring the event from the wording is exactly
   * the guessing the field exists to replace.
   */
  it('leaves rows without a kind alone, however alike they look', () => {
    const sections = buildNotificationSections(
      [
        row('a', '2026-09-11T09:00:00Z'),
        row('b', '2026-09-11T09:01:00Z'),
        row('c', '2026-09-11T09:02:00Z', { kind: '' }),
      ],
      { now: NOW },
    );

    expect(sections[0].entries).toHaveLength(3);
  });

  it('groups by kind and not by the title, which is prose', () => {
    const sections = buildNotificationSections(
      [
        row('a', '2026-09-11T09:00:00Z', { kind: 'appointment.booked', title: 'Nový termín' }),
        row('b', '2026-09-11T09:01:00Z', { kind: 'appointment.booked', title: 'Nová rezervace' }),
      ],
      { now: NOW },
    );

    expect(sections[0].entries[0].entry).toBe('group');
  });

  it('counts unread inside a group without reordering it', () => {
    const sections = buildNotificationSections(
      [
        row('a', '2026-09-11T09:02:00Z', { kind: 'intake.submitted', read: true }),
        row('b', '2026-09-11T09:01:00Z', { kind: 'intake.submitted', read: false }),
        row('c', '2026-09-11T09:00:00Z', { kind: 'intake.submitted', read: true }),
      ],
      { now: NOW },
    );

    const group = sections[0].entries[0];
    expect(group.entry).toBe('group');
    if (group.entry === 'group') {
      expect(group.rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
      expect(group.unreadCount).toBe(1);
    }
  });

  it('drops a row whose timestamp cannot be read, rather than sorting round it', () => {
    const sections = buildNotificationSections(
      [row('ok', '2026-09-11T09:00:00Z'), row('bad', 'nonsense')],
      { now: NOW },
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].entries).toHaveLength(1);
  });
});

describe('the new-since line', () => {
  const rows = [
    row('n1', '2026-09-11T11:00:00Z', { kind: 'intake.submitted' }),
    row('n2', '2026-09-11T10:30:00Z', { kind: 'intake.submitted' }),
    row('seen', '2026-09-11T08:00:00Z', { kind: 'intake.submitted' }),
  ];

  it('sits between what arrived since the last look and what was already there', () => {
    const sections = buildNotificationSections(rows, {
      now: NOW,
      lastSeenAt: '2026-09-11T09:00:00Z',
    });

    const boundary = newSinceBoundary(sections);
    expect(boundary).toEqual({ sectionKey: '2026-09-11', index: 1 });
  });

  it('keeps new and seen rows out of the same group, so the line has somewhere to go', () => {
    const sections = buildNotificationSections(rows, {
      now: NOW,
      lastSeenAt: '2026-09-11T09:00:00Z',
    });

    expect(sections[0].entries).toHaveLength(2);
    expect(sections[0].entries[0].isNew).toBe(true);
    expect(sections[0].entries[1].isNew).toBe(false);
  });

  /* No marker from the server yet: no line, rather than a line at the top. */
  it('draws nothing when the server has not said when we last looked', () => {
    const sections = buildNotificationSections(rows, { now: NOW });
    expect(newSinceBoundary(sections)).toBeNull();
  });

  it('draws nothing when everything is new, or everything is old', () => {
    const allNew = buildNotificationSections(rows, {
      now: NOW,
      lastSeenAt: '2026-09-11T07:00:00Z',
    });
    expect(newSinceBoundary(allNew)).toBeNull();

    const allOld = buildNotificationSections(rows, {
      now: NOW,
      lastSeenAt: '2026-09-11T12:00:00Z',
    });
    expect(newSinceBoundary(allOld)).toBeNull();
  });
});

describe('groupLabel', () => {
  it('uses the Czech plural people actually use', () => {
    expect(groupLabel('appointment.booked', 1)).toBe('1 nový termín');
    expect(groupLabel('appointment.booked', 3)).toBe('3 nové termíny');
    expect(groupLabel('appointment.booked', 8)).toBe('8 nových termínů');
    expect(groupLabel('intake.submitted', 5)).toBe('5 nových dotazníků');
  });

  it('falls back to showing the kind rather than inventing a noun', () => {
    expect(groupLabel('something.new', 4)).toBe('4× something.new');
  });
});
