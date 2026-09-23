/*
 * The two switches on a holiday, without a browser.
 *
 * What cannot be seen on screen: that switching a statutory day back to closed
 * removes the amendment rather than writing a second one, that "online off"
 * lands on every active calendar and names the ones that cannot take it, and
 * that turning it off only removes what it put there.
 */
import { describe, it, expect } from 'vitest';
import type { Calendar, ScheduleException } from '../../api/bookingContracts';
import type { ClinicHoliday } from '../../api/holidays';
import {
  isOnlineOnlyClosure,
  onlinePlan,
  onlineState,
  workingSwitchAction,
} from './holidayDay';

const holiday = (over: Partial<ClinicHoliday> = {}): ClinicHoliday => ({
  date: '2026-10-28',
  name: 'Den vzniku samostatného československého státu',
  isHoliday: true,
  isStatutory: true,
  isAmended: false,
  ...over,
});

const calendar = (id: string, over: Partial<Calendar> = {}): Calendar => ({
  id,
  name: id === 'c1' ? 'Sportovní diagnostika' : 'Sportovní prohlídka',
  color: '#0D7377',
  location: '',
  displayStepMinutes: 15,
  isActive: true,
  sortOrder: 0,
  clinicServiceId: null,
  publicMinimumNoticeMinutes: null,
  publicHorizonDays: null,
  publicHoldMinutes: null,
  publicCancellationHours: null,
  ...over,
});

const exception = (over: Partial<ScheduleException> = {}): ScheduleException => ({
  id: 'e1',
  date: '2026-10-28',
  isClosed: false,
  startTime: null,
  endTime: null,
  workerUserId: null,
  reason: '',
  isClosedToPublic: true,
  ...over,
});

describe('Pracujeme v tento den', () => {
  it('opens a statutory holiday with its own name as the reason', () => {
    expect(workingSwitchAction(holiday(), true)).toEqual({
      kind: 'save',
      isHoliday: false,
      name: 'Den vzniku samostatného československého státu',
    });
  });

  it('closes a statutory day by giving it back to the law', () => {
    expect(workingSwitchAction(holiday({ isHoliday: false, isAmended: true }), false)).toEqual({ kind: 'reset' });
  });

  it('closes the clinic’s own day with a reason', () => {
    expect(workingSwitchAction(holiday({ isStatutory: false, isHoliday: false, name: '' }), false)).toEqual({
      kind: 'save',
      isHoliday: true,
      name: 'Volno',
    });
  });
});

describe('Online objednávky vypnuty', () => {
  const both = (c1: ScheduleException[] = [], c2: ScheduleException[] = []) => [
    { calendar: calendar('c1'), exceptions: c1 },
    { calendar: calendar('c2'), exceptions: c2 },
  ];

  it('knows a pure online closure from any other exception', () => {
    expect(isOnlineOnlyClosure(exception())).toBe(true);
    expect(isOnlineOnlyClosure(exception({ isClosed: true }))).toBe(false);
    expect(isOnlineOnlyClosure(exception({ startTime: '08:00', endTime: '12:00' }))).toBe(false);
    expect(isOnlineOnlyClosure(exception({ isClosedToPublic: false }))).toBe(false);
  });

  it('reads the state across the active calendars', () => {
    expect(onlineState('2026-10-28', both())).toBe('open');
    expect(onlineState('2026-10-28', both([exception()]))).toBe('partly');
    expect(onlineState('2026-10-28', both([exception()], [exception({ id: 'e2' })]))).toBe('closed');
    // Another date does not count.
    expect(onlineState('2026-10-28', both([exception({ date: '2026-10-27' })]))).toBe('open');
  });

  it('ignores an inactive calendar, which takes no bookings anyway', () => {
    const entries = [
      { calendar: calendar('c1'), exceptions: [exception()] },
      { calendar: calendar('c2', { isActive: false }), exceptions: [] },
    ];

    expect(onlineState('2026-10-28', entries)).toBe('closed');
    expect(onlinePlan('2026-10-28', 'Svátek', entries, true).create).toEqual([]);
  });

  it('switching on writes one online-only exception per calendar', () => {
    const plan = onlinePlan('2026-10-28', 'Den vzniku', both(), true);

    expect(plan.create.map((c) => c.calendarId)).toEqual(['c1', 'c2']);
    expect(plan.create[0].input).toEqual({
      date: '2026-10-28',
      isClosed: false,
      startTime: null,
      endTime: null,
      workerUserId: null,
      reason: 'Online objednávky vypnuty – Den vzniku',
      isClosedToPublic: true,
    });
    expect(plan.remove).toEqual([]);
  });

  it('names a calendar that already has another exception that day instead of skipping it quietly', () => {
    const plan = onlinePlan('2026-10-28', 'Den vzniku', both([exception({ isClosedToPublic: false, startTime: '08:00', endTime: '12:00' })]), true);

    expect(plan.blocked).toEqual(['Sportovní diagnostika']);
    expect(plan.create.map((c) => c.calendarId)).toEqual(['c2']);
  });

  it('switching off removes only what the switch puts there', () => {
    const plan = onlinePlan(
      '2026-10-28',
      'Den vzniku',
      both([exception({ id: 'online' })], [exception({ id: 'hours', startTime: '08:00', endTime: '12:00' })]),
      false,
    );

    expect(plan.remove).toEqual([{ calendarId: 'c1', id: 'online' }]);
    expect(plan.create).toEqual([]);
  });
});
