/*
 * The arithmetic behind Kluby a týmy, pinned where it can be read: which
 * discount band a headcount lands in, how an order's money is explained, which
 * club an order belongs to, when a club counts as having a reservation running,
 * and how the seat table is filled - taken places first, then the open ones on
 * the plan's times.
 */
import { describe, expect, it } from 'vitest';
import type { Club } from '../../services/clubsApi';
import type { PartnerOrderDetail } from '../../api/partnerOrders';
import type { DayAppointment } from '../../api/bookingContracts';
import { pragueWallClockToInstant } from '../../utils/time';
import {
  clubStatus, describeTier, discountPercentFor, formatCzk, formatDateRange, formatDiscount,
  formatShortRange, formatWeekdayDate, isOrderActive, matchesSearch, orderTotal, ordersOfClub,
  pragueHHMM, primaryOrder, seatRows,
} from './clubOrders';

const tiers = [
  { minHeadcount: 10, maxHeadcount: null, percent: 10 },
  { minHeadcount: 5, maxHeadcount: 9, percent: 5 },
];

const club = (over: Partial<Club> = {}): Club => ({
  id: 'club-1', name: 'FK Slaný', ico: '12345678', contactPerson: 'Jan Trenér',
  contactPhone: '+420 603 221 004', paymentTermsDays: 14, isActive: true,
  createdAt: '2026-01-01T00:00:00Z', ...over,
});

const order = (over: Partial<PartnerOrderDetail> = {}): PartnerOrderDetail => ({
  id: 'o-1', calendarId: 'c-1', partnerName: 'FK Slaný', partnerType: 0, note: '',
  contactEmail: null, linkSentAt: null, expiresAt: null, isRevoked: false,
  requestedCount: 12, bookedCount: 4, requiredMinutes: 720, coveredMinutes: 600, missingMinutes: 120,
  items: [{
    activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15,
    requestedCount: 12, bookedCount: 4, remaining: 8, requiredMinutes: 180,
  }],
  windows: [
    { id: 'w-1', date: '2026-10-26', startTime: '11:00:00', endTime: '12:00:00', coveredMinutes: 60,
      releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true },
    { id: 'w-2', date: '2026-10-27', startTime: '09:00:00', endTime: '10:00:00', coveredMinutes: 60,
      releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true },
  ],
  clubId: 'club-1', token: null, ...over,
});

describe('discount bands', () => {
  it('lands a headcount in the clinic\'s band, in ascending order of the lower bound', () => {
    expect(discountPercentFor(tiers, 12)).toBe(10);
    expect(discountPercentFor(tiers, 7)).toBe(5);
    expect(discountPercentFor(tiers, 10)).toBe(10);
    expect(discountPercentFor(tiers, 9)).toBe(5);
  });

  it('applies no band below the first one, for no headcount, or with no table', () => {
    expect(discountPercentFor(tiers, 3)).toBeNull();
    expect(discountPercentFor(tiers, null)).toBeNull();
    expect(discountPercentFor(tiers, 0)).toBeNull();
    expect(discountPercentFor([], 50)).toBeNull();
  });

  it('writes the band the board\'s way', () => {
    expect(formatDiscount(10)).toBe('−10 %');
    expect(formatDiscount(null)).toBe('—');
    expect(describeTier(tiers, 12)).toBe('−10 % (10+ osob)');
    expect(describeTier(tiers, 6)).toBe('−5 % (5–9 osob)');
    expect(describeTier(tiers, 2)).toBe('—');
  });
});

describe('money', () => {
  it('is seats × price less the band for that many seats', () => {
    const total = orderTotal(order(), () => 2200, tiers);
    expect(total.seats).toBe(12);
    expect(total.percent).toBe(10);
    expect(total.total).toBe(23760);
    expect(total.explain).toBe(`12 × ${formatCzk(2200)} se slevou 10 %`);
  });

  it('says so when a činnost has no price rather than summing a zero', () => {
    const total = orderTotal(order(), () => null, tiers);
    expect(total.total).toBeNull();
    expect(total.explain).toBe('Některá činnost nemá cenu v ceníku');
  });

  it('lists each line when the prices differ', () => {
    const two = order({
      items: [
        ...order().items,
        { activityId: 'a-2', activityName: 'Spiro', durationMinutes: 30, requestedCount: 2, bookedCount: 0, remaining: 2, requiredMinutes: 60 },
      ],
    });
    const total = orderTotal(two, (id) => (id === 'a-1' ? 2200 : 4000), tiers);
    expect(total.seats).toBe(14);
    expect(total.total).toBe((12 * 2200 + 2 * 4000) * 0.9);
    expect(total.unitPrice).toBeNull();
    expect(total.explain).toContain('+');
  });

  it('formats crowns with a thousands group and no decimals', () => {
    expect(formatCzk(23760).replace(/ /g, ' ')).toBe('23 760 Kč');
    expect(formatCzk(2200.4).replace(/ /g, ' ')).toBe('2 200 Kč');
  });
});

describe('matching orders to clubs', () => {
  it('matches by clubId when the order carries one, and by name when it does not', () => {
    const own = ordersOfClub(club(), [
      order({ id: 'by-id', clubId: 'club-1', partnerName: 'Jiné jméno' }),
      order({ id: 'other-club', clubId: 'club-2', partnerName: 'FK Slaný' }),
      order({ id: 'by-name', clubId: null, partnerName: '  fk slany ' }),
      order({ id: 'stranger', clubId: null, partnerName: 'SK Kladno' }),
    ]);
    expect(own.map((o) => o.id)).toEqual(['by-id', 'by-name']);
  });

  it('searches name, contact person and phone without caring about accents', () => {
    expect(matchesSearch(club(), 'slany')).toBe(true);
    expect(matchesSearch(club(), 'trenér')).toBe(true);
    expect(matchesSearch(club(), '603 221')).toBe(true);
    expect(matchesSearch(club(), 'kladno')).toBe(false);
    expect(matchesSearch(club(), '')).toBe(true);
  });
});

describe('club status', () => {
  const today = '2026-10-03';

  it('is active while a held day is still ahead and the link is live', () => {
    expect(isOrderActive(order(), today)).toBe(true);
    expect(clubStatus([order()], today)).toBe('active');
  });

  it('is done once the days are behind it, the link is revoked, or it has expired', () => {
    expect(clubStatus([order()], '2026-11-01')).toBe('done');
    expect(clubStatus([order({ isRevoked: true })], today)).toBe('done');
    expect(
      clubStatus([order({ expiresAt: '2026-09-01T00:00:00Z' })], today, new Date('2026-10-03T08:00:00Z')),
    ).toBe('done');
  });

  it('is "none" for a club with no order at all', () => {
    expect(clubStatus([], today)).toBe('none');
  });

  it('opens on the active order with the nearest day, else the most recent one', () => {
    const later = order({ id: 'later', windows: [{ ...order().windows[0], date: '2026-12-01' }] });
    const past = order({ id: 'past', windows: [{ ...order().windows[0], date: '2026-05-01' }] });
    expect(primaryOrder([later, order(), past], today)?.id).toBe('o-1');
    expect(primaryOrder([past, order({ id: 'older', windows: [{ ...order().windows[0], date: '2025-05-01' }] })], today)?.id).toBe('past');
    expect(primaryOrder([], today)).toBeNull();
  });
});

describe('dates', () => {
  it('writes the board\'s ranges', () => {
    expect(formatDateRange('2026-10-26', '2026-10-27')).toBe('26.—27. října 2026');
    expect(formatDateRange('2026-10-26', '2026-10-26')).toBe('26. října 2026');
    expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('30. října — 2. listopadu 2026');
    expect(formatShortRange('2026-10-26', '2026-10-27')).toBe('26.—27. 10. 2026');
    expect(formatWeekdayDate('2026-10-26')).toBe('Po 26. 10.');
  });

  it('reads a Prague wall-clock time off a UTC instant, zero-padded', () => {
    expect(pragueHHMM(pragueWallClockToInstant('2026-10-26', '08:05'))).toBe('08:05');
    expect(pragueHHMM('2026-07-01T10:30:00Z')).toBe('12:30');
  });
});

describe('seat rows', () => {
  const appt = (id: string, date: string, time: string, over: Partial<DayAppointment> = {}): DayAppointment => ({
    id, calendarId: 'c-1', patientId: '', activityId: 'a-1', activityName: 'Komplexní prohlídka',
    startUtc: pragueWallClockToInstant(date, time).toISOString(),
    endUtc: pragueWallClockToInstant(date, time).toISOString(),
    status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, patientName: 'Jan Novák', ...over,
  });

  it('lists the athletes inside the held windows, then the open places on the plan\'s times', () => {
    const rows = seatRows(order({ requestedCount: 6, bookedCount: 3, items: [{ ...order().items[0], requestedCount: 6, bookedCount: 3, remaining: 3 }] }), [
      appt('a', '2026-10-26', '11:15', { patientName: 'Petr Malý' }),
      appt('b', '2026-10-26', '11:00'),
      appt('c', '2026-10-27', '09:00', { paperwork: { ready: false, missing: ['questionnaire'] }, patientName: 'Adam Říha' }),
      appt('cancelled', '2026-10-26', '11:30', { status: 4 }),
      appt('outside', '2026-10-26', '15:00', { patientName: 'Cizí Pacient' }),
    ]);

    expect(rows.map((r) => r.name)).toEqual(['Jan Novák', 'Petr Malý', 'Adam Říha', null, null, null]);
    expect(rows[0].when).toBe('Po 26. 10. 11:00');
    expect(rows[2].state).toBe('missingQuestionnaire');
    expect(rows[0].state).toBe('registered');
    expect(rows[3]).toMatchObject({ state: 'waiting', activityName: 'Komplexní prohlídka', when: 'Po 26. 10. 11:00' });
    expect(rows[5].when).toBe('Po 26. 10. 11:30');
  });

  it('never lists more open places than the order asked for', () => {
    const rows = seatRows(order({ requestedCount: 2, bookedCount: 2 }), [
      appt('a', '2026-10-26', '11:00'),
      appt('b', '2026-10-26', '11:15'),
      appt('c', '2026-10-26', '11:30'),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.name !== null)).toBe(true);
  });
});
