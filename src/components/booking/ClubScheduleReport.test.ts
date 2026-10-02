/*
 * The rozpis the clinic hands a coach: windows filled from their start in
 * steps of the činnost's length, the places that do not fit reported rather
 * than hidden, and a fixed unit for the "Míst" column so mixed lengths do not
 * make the capacity drift window to window.
 */
import { describe, expect, it } from 'vitest';
import type { PartnerOrder } from '../../api/bookingContracts';
import { planSchedule } from './ClubScheduleReport';

const window = (id: string, date: string, start: string, end: string, covered: number) => ({
  id, date, startTime: start, endTime: end, coveredMinutes: covered,
  releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true,
});

const order = (over: Partial<PartnerOrder> = {}): PartnerOrder => ({
  id: 'o', calendarId: 'c', partnerName: 'FK Slaný', partnerType: 0, note: '', contactEmail: null,
  linkSentAt: null, expiresAt: null, isRevoked: false, requestedCount: 5, bookedCount: 1,
  requiredMinutes: 0, coveredMinutes: 0, missingMinutes: 0,
  items: [{ activityId: 'a', activityName: 'Základní', durationMinutes: 30, requestedCount: 5, bookedCount: 1, remaining: 4, requiredMinutes: 120 }],
  windows: [window('w2', '2026-10-27', '09:00:00', '10:00:00', 60), window('w1', '2026-10-26', '08:00:00', '09:30:00', 90)],
  ...over,
});

describe('planSchedule', () => {
  it('fills the windows in date order from their start, only with the places still wanted', () => {
    const plan = planSchedule(order());
    expect(plan.windows.map((w) => w.date)).toEqual(['2026-10-26', '2026-10-27']);
    expect(plan.windows[0].slots.map((s) => s.time)).toEqual(['08:00', '08:30', '09:00']);
    expect(plan.windows[1].slots.map((s) => s.time)).toEqual(['09:00']);
    expect(plan.placed).toBe(4);
    expect(plan.totalRequested).toBe(4);
    expect(plan.totalCapacity).toBe(3 + 2);
  });

  it('reports what does not fit instead of hiding it', () => {
    const plan = planSchedule(order({ items: [{ ...order().items[0], requestedCount: 9, bookedCount: 0, remaining: 9 }] }));
    expect(plan.placed).toBe(5);
    expect(plan.totalRequested).toBe(9);
  });
});
