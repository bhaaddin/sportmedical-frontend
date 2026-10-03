import { describe, expect, it } from 'vitest';
import {
  completionUrl,
  deadlineSentence,
  deadlineView,
  formatDeadline,
  pendingChipText,
} from './quickBooking';

/*
 * The words around the quick registration's deadline. The length of the
 * deadline is the server's setting, so none of these ever knows "24 hodin":
 * they only read the instant the server sent.
 */

const HOUR = 3_600_000;

describe('how the deadline is worded', () => {
  it('writes it as d. M. yyyy HH:mm in Prague time', () => {
    /* 2026-10-04T12:30Z is 14:30 in Prague (CEST). */
    expect(formatDeadline('2026-10-04T12:30:00Z')).toBe('4. 10. 2026 14:30');
    /* Winter time: 2026-12-24T09:05Z is 10:05. */
    expect(formatDeadline('2026-12-24T09:05:00Z')).toBe('24. 12. 2026 10:05');
    expect(formatDeadline('not a date')).toBe('');
  });

  it('builds the sentence the desk reads out', () => {
    expect(deadlineSentence('2026-10-04T12:30:00Z')).toBe(
      'Pacient má čas na dokončení registrace do 4. 10. 2026 14:30',
    );
  });
});

describe('how much of the deadline is left', () => {
  const deadline = '2026-10-04T12:00:00Z';
  const at = (msBefore: number) => new Date(Date.parse(deadline) - msBefore);

  it('counts hours rounded up, in beige', () => {
    const view = deadlineView(deadline, at(20.5 * HOUR));
    expect(view).toEqual({ remaining: 'zbývá 21 h', tone: 'beige', expired: false });
    expect(pendingChipText(view)).toBe('Čeká na dokončení registrace · zbývá 21 h');
    expect(deadlineView(deadline, at(23 * HOUR)).remaining).toBe('zbývá 23 h');
  });

  it('turns red under three hours, and not a minute before', () => {
    expect(deadlineView(deadline, at(3 * HOUR + 60_000)).tone).toBe('beige');
    expect(deadlineView(deadline, at(3 * HOUR)).tone).toBe('beige');
    expect(deadlineView(deadline, at(3 * HOUR - 60_000)).tone).toBe('red');
    expect(deadlineView(deadline, at(2 * HOUR)).remaining).toBe('zbývá 2 h');
  });

  it('counts minutes in the last hour', () => {
    expect(deadlineView(deadline, at(35 * 60_000))).toEqual({ remaining: 'zbývá 35 min', tone: 'red', expired: false });
    expect(deadlineView(deadline, at(60 * 60_000)).remaining).toBe('zbývá 1 h');
  });

  it('says so when the time is up', () => {
    const view = deadlineView(deadline, at(-1000));
    expect(view).toEqual({ remaining: 'lhůta vypršela', tone: 'red', expired: true });
    expect(pendingChipText(view)).toBe('Čeká na dokončení registrace · lhůta vypršela');
  });
});

describe('the completion link', () => {
  it('prefers the address the server sent', () => {
    expect(completionUrl({ url: 'https://x.test/dokonceni/t1', token: 't1' }, 'http://localhost')).toBe(
      'https://x.test/dokonceni/t1',
    );
  });

  it('builds it from the token, and only the token, when the server sent none', () => {
    expect(completionUrl({ url: null, token: 't1' }, 'https://app.test')).toBe('https://app.test/dokonceni/t1');
    // A relative path from the server gets the app's origin: a bare path cannot be pasted into a message.
    expect(completionUrl({ url: '/dokonceni/t1', token: 't1' }, 'https://app.test')).toBe('https://app.test/dokonceni/t1');
    expect(completionUrl({ url: '  ', token: 't1' }, 'https://app.test')).toBe('https://app.test/dokonceni/t1');
  });
});
