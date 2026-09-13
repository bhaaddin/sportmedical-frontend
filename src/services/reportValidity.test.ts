/*
 * The výpis, and the two questions one date has to answer.
 *
 * Booking sends `reportValidUntil` as a date rather than a number of days, and
 * the reason is the thing worth testing: a count of days has to be counted
 * from somewhere, and the card counts from today while an appointment counts
 * from its own day. The same výpis is "platí ještě 4 měsíce" on one screen and
 * "v den prohlídky už platný nebude" on the other, and both are true.
 *
 * `null` is one answer for three situations - never uploaded, expired, or
 * uploaded with the date left blank. The owner asked for one sentence for all
 * of them and no frightening, so nothing here tries to tell them apart.
 */
import { describe, it, expect } from 'vitest';
import {
  LAST_DAY_IS_INCLUSIVE, remainingText, reportStandsOn, reportValidity,
} from './reportValidity';

const TODAY = '2026-09-13';

describe('when there is no valid výpis', () => {
  /* Three reasons, one answer - the owner asked for exactly that. */
  it.each([null, undefined, ''])('is missing for %s', (value) => {
    expect(reportValidity(value, TODAY)).toEqual({ kind: 'missing' });
  });

  /*
   * A date we cannot read is not a valid výpis. Saying "platí" about one is
   * the worst of the three answers: it lets somebody be seen on the strength
   * of a document nobody checked.
   */
  it('is missing for a date that cannot be read', () => {
    expect(reportValidity('kdysi', TODAY).kind).toBe('missing');
    expect(reportValidity('2026-13-01', TODAY).kind).toBe('missing');
    /* 31 February would silently become 3 March in a `Date`. */
    expect(reportValidity('2026-02-31', TODAY).kind).toBe('missing');
  });
});

describe('measured against a day', () => {
  it('is valid while the date is ahead', () => {
    const v = reportValidity('2027-01-13', TODAY);
    expect(v.kind).toBe('valid');
    expect(v.kind === 'valid' && v.daysLeft).toBe(122);
  });

  it('is expired once the date has passed', () => {
    const v = reportValidity('2026-05-03', TODAY);
    expect(v.kind).toBe('expired');
    expect(v.kind === 'expired' && v.daysAgo).toBe(133);
  });

  /*
   * The boundary decides a real day: on it a patient is either seen or sent
   * home. "Platí do 3. 5." reads as 3 May included, so it is valid that day.
   * Stated as an assumption in the module and asked of booking.
   */
  it('counts the last day as still valid', () => {
    expect(LAST_DAY_IS_INCLUSIVE).toBe(true);
    expect(reportValidity(TODAY, TODAY)).toMatchObject({ kind: 'valid', daysLeft: 0 });
    expect(reportValidity('2026-09-12', TODAY).kind).toBe('expired');
  });

  /*
   * The whole reason a date is sent and not a count. One výpis, two screens,
   * two true answers.
   */
  it('gives different answers for today and for the day of an appointment', () => {
    const until = '2026-10-01';
    expect(reportStandsOn(until, '2026-09-13')).toBe(true);
    expect(reportStandsOn(until, '2026-11-20')).toBe(false);
  });

  it('takes a Date as readily as a string, since the appointment carries one', () => {
    expect(reportStandsOn('2026-10-01', new Date(2026, 8, 13))).toBe(true);
    expect(reportStandsOn('2026-10-01', new Date(2026, 10, 20))).toBe(false);
  });

  /* Local midnights, so a time of day cannot move the answer across a day. */
  it('ignores the time of day on the appointment', () => {
    const early = new Date(2026, 9, 1, 0, 5);
    const late = new Date(2026, 9, 1, 23, 55);
    expect(reportStandsOn('2026-10-01', early)).toBe(true);
    expect(reportStandsOn('2026-10-01', late)).toBe(true);
  });

  it('survives the clock change without losing or gaining a day', () => {
    /* Prague springs forward 29 March 2026 and back 25 October 2026. A day
       count done in hours would be out by one across each. */
    expect(reportValidity('2026-03-30', '2026-03-28')).toMatchObject({ daysLeft: 2 });
    expect(reportValidity('2026-10-26', '2026-10-24')).toMatchObject({ daysLeft: 2 });
  });
});

describe('what the card says about the time left', () => {
  it('counts days while it is close', () => {
    expect(remainingText(0)).toBe('platí jen dnes');
    expect(remainingText(1)).toBe('platí ještě dnes a zítra');
    expect(remainingText(6)).toBe('platí ještě 6 dní');
    expect(remainingText(29)).toBe('platí ještě 29 dní');
  });

  /* "Platí ještě 132 dní" is a number nobody converts. */
  it('counts months once there are months of it', () => {
    expect(remainingText(30)).toBe('platí ještě měsíc');
    expect(remainingText(122)).toBe('platí ještě 4 měsíce');
  });

  /* Czech counts 2-4 one way and 5 and up another. */
  it('says měsíce and měsíců where Czech does', () => {
    expect(remainingText(120)).toContain('měsíce');
    expect(remainingText(180)).toContain('měsíců');
  });
});
