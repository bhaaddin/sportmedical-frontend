/*
 * Whether the patient may still change their booking, decided from the
 * server's own deadline and a fixed clock. The page hides the buttons on this;
 * the server refuses on its own rule either way.
 */
import { describe, it, expect } from 'vitest';
import { canStillChange } from './publicManage';
import type { ManagedBooking } from './publicManage';

const booking = (over: Partial<ManagedBooking> = {}): ManagedBooking => ({
  appointmentId: 'a',
  serviceName: 'Sportovní prohlídky',
  activityName: 'Základní prohlídka',
  startUtc: '2026-09-24T07:00:00Z',
  endUtc: '2026-09-24T07:30:00Z',
  isCancelled: false,
  calendarId: 'c',
  activityId: 'x',
  canChangeUntilUtc: '2026-09-23T07:00:00Z',
  changeDeadlineHours: 24,
  ...over,
});

describe('canStillChange', () => {
  it('allows a change while the deadline has not passed', () => {
    expect(canStillChange(booking(), new Date('2026-09-22T12:00:00Z'))).toBe(true);
    expect(canStillChange(booking(), new Date('2026-09-23T07:00:00Z'))).toBe(true);
  });

  it('refuses once the deadline has passed, by the server’s moment', () => {
    expect(canStillChange(booking(), new Date('2026-09-23T07:00:01Z'))).toBe(false);
  });

  it('never offers a change on a cancelled booking', () => {
    expect(canStillChange(booking({ isCancelled: true }), new Date('2026-09-01T00:00:00Z'))).toBe(false);
  });

  it('keeps the buttons when an older server sends no deadline — the server still refuses a late change', () => {
    expect(canStillChange(booking({ canChangeUntilUtc: undefined }), new Date('2026-09-24T06:59:00Z'))).toBe(true);
    expect(canStillChange(booking({ canChangeUntilUtc: null }), new Date('2026-09-24T06:59:00Z'))).toBe(true);
  });
});
