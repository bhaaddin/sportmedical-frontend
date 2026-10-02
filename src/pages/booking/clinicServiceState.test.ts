/*
 * A služba that cannot carry a booking, and looks exactly like one that can.
 *
 * The service is what carries meaning now: činnosti belong to it, a calendar
 * runs it, and a required document hangs off it. So it has two ways of being
 * useless, and neither shows up anywhere else in the application:
 *
 *     no činnosti    nothing to book under it, ever
 *     no kalendář    nothing is booked in it, because nowhere runs it
 *
 * A clinic with three services, one of them empty, reads as a clinic where
 * everything works - and the first anybody hears of it is a day offering
 * nothing for a reason that is invisible on the day. That is the shape this
 * project keeps finding, so the list says it on the row.
 */
import { describe, it, expect } from 'vitest';
import {
  SERVICE_GAP_TEXT, countsText, deletionWillBeRefused, serviceGap,
} from './clinicServiceState';

const service = (over: Partial<Parameters<typeof serviceGap>[0]> = {}) => ({
  isActive: true,
  activities: 3,
  calendars: 1,
  ...over,
});

describe('what a service is missing', () => {
  it('is nothing when it has činnosti and a calendar', () => {
    expect(serviceGap(service())).toBe('none');
  });

  it('names an empty service', () => {
    expect(serviceGap(service({ activities: 0 }))).toBe('no-activities');
  });

  /*
   * The quieter of the two. The činnosti exist and look fine on their own
   * screen; there is simply nowhere they can be booked.
   */
  it('names one nothing runs', () => {
    expect(serviceGap(service({ calendars: 0 }))).toBe('no-calendar');
  });

  it('says both at once as one sentence, not two', () => {
    expect(serviceGap(service({ activities: 0, calendars: 0 }))).toBe('nothing-set-up');
  });

  /*
   * A retired service is meant to offer nothing. Warning about it would put a
   * warning on every service the owner has deliberately put away - and a
   * warning that is always there is one nobody reads.
   */
  it('says nothing about a service that is not active', () => {
    expect(serviceGap(service({ isActive: false, activities: 0, calendars: 0 }))).toBe('none');
    expect(serviceGap(service({ isActive: false }))).toBe('none');
  });

  /* Every gap has words, or the row would warn in silence. */
  it('has a sentence for each gap', () => {
    for (const gap of ['no-activities', 'no-calendar', 'nothing-set-up'] as const) {
      expect(SERVICE_GAP_TEXT[gap], gap).toMatch(/\S/);
    }
  });
});

describe('whether deleting will be refused', () => {
  /*
   * Said before the click, not after it. Unlike a calendar this is never
   * final - a service empties as its činnosti are moved - so it is a "not
   * yet", and the screen says which.
   */
  it('is refused while anything hangs off it', () => {
    expect(deletionWillBeRefused(service({ activities: 1, calendars: 0 }))).toBe(true);
    expect(deletionWillBeRefused(service({ activities: 0, calendars: 1 }))).toBe(true);
  });

  it('is not refused once it carries nothing', () => {
    expect(deletionWillBeRefused(service({ activities: 0, calendars: 0 }))).toBe(false);
  });

  /* Being retired does not empty it, so it does not make it deletable. */
  it('is refused for an inactive service that still carries things', () => {
    expect(deletionWillBeRefused(service({ isActive: false }))).toBe(true);
  });
});

describe('the counts, in Czech', () => {
  it('counts one, a few, and many the way Czech does', () => {
    expect(countsText(service({ activities: 1, calendars: 1 }))).toBe('1 činnost · 1 kalendář');
    expect(countsText(service({ activities: 3, calendars: 2 }))).toBe('3 činnosti · 2 kalendáře');
    expect(countsText(service({ activities: 7, calendars: 5 }))).toBe('7 činností · 5 kalendářů');
  });

  /* Zero takes the many form, and is the case the row is most often showing. */
  it('says zero the way Czech says it', () => {
    expect(countsText(service({ activities: 0, calendars: 0 }))).toBe('0 činností · 0 kalendářů');
  });
});
