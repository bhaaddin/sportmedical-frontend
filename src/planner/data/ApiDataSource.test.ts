/*
 * Contract tests of `ApiDataSource`: the application's API clients are replaced by fakes with the same shapes
 * (`../api/testSupport.ts`), so every mapping is checked against exact numbers without a server.
 */
import { describe, expect, it } from 'vitest';
import { BookingApiError } from '../../api/apiError';
import { ClubOrderError } from '../../api/clubOrders';
import {
  A_MEDICAL,
  A_SPIRO,
  CAL_A,
  CAL_B,
  SVC,
  appt,
  athlete,
  club,
  clubBlock,
  editSession,
  fakeDeps,
  fakeState,
  newSession,
  orderView,
  preview,
  timeBlock,
  type FakeState,
} from '../api/testSupport';
import { ApiDataSource, PlannerDuplicateOrderError } from './ApiDataSource';
import { PlannerWriteError } from './PlannerDataSource';
import type { PickSession } from '../../components/clubs/order/pickSession';

const TODAY = '2026-11-02';
const ORDER_CODE = 'KO-0000ABCD';

function make(state: FakeState = fakeState(), session: PickSession | null = null, extra: Partial<ConstructorParameters<typeof ApiDataSource>[0]> = {}) {
  const deps = fakeDeps(state);
  let n = 0;
  const source = new ApiDataSource({ deps, session, today: TODAY, newId: () => `NEW${n++}`, ...extra });
  return { source, deps, state };
}

const WEEK = { from: '2026-11-02', to: '2026-11-08' };

describe('catalogue', () => {
  it('maps the činnosti: name, price, slot length, parallel capacity, colour, služba, neutral icon', async () => {
    const { source } = make();
    const cat = await source.getCatalogue();
    expect(cat.categories).toEqual([
      {
        id: A_MEDICAL,
        name: 'Základní prohlídka',
        iconKey: 'heart',
        color: '#112233',
        subtitle: 'Sportovní prohlídky',
        slotMinutes: 30,
        parallelCapacity: 1,
        priceCzk: 1500,
      },
      {
        id: A_SPIRO,
        name: 'Spiroergometrie',
        iconKey: 'heart',
        color: '#aa5500',
        subtitle: 'Sportovní prohlídky',
        slotMinutes: 60,
        parallelCapacity: 1,
        priceCzk: 2400,
      },
    ]);
    expect(cat.clinicName).toBe('Klinika Test');
  });

  it('colours from the činnost, then the služba, then a neutral grey - never per name', async () => {
    const state = fakeState();
    state.activities = [
      { ...state.activities[0]!, effectiveColorHex: null, colorHex: null, color: 'blue' },
      { ...state.activities[1]!, effectiveColorHex: null, colorHex: '#00ff00' },
    ];
    const { source } = make(state);
    const cat = await source.getCatalogue();
    expect(cat.categories.map((c) => c.color)).toEqual(['#445566', '#00ff00']);
    const { source: none } = make(fakeState({ calendars: [] }));
    expect((await none.getCatalogue()).categories).toHaveLength(2);
  });

  it('takes the day window, the closed-day and lunch colours from the display settings and the open hours', async () => {
    const { source } = make();
    const cat = await source.getCatalogue();
    expect(cat.window).toEqual({ startMinutes: 7 * 60, endMinutes: 19 * 60 });
    expect(cat.dayMarkColors).toEqual({ holiday: '#AA0000', lunch: '#BBBBBB' });
    const wide = fakeState({ previews: (_c, date) => preview(date, { startTime: '06:30', endTime: '20:15' }) });
    expect((await make(wide).source.getCatalogue()).window).toEqual({ startMinutes: 6 * 60, endMinutes: 21 * 60 });
  });

  it('release days: the order wins, then the club settings; "never" is flagged', async () => {
    const { source: standard } = make();
    expect(await standard.getCatalogue()).toMatchObject({ releaseDaysBefore: 5 });
    const { source: planning } = make(fakeState(), editSession());
    expect(await planning.getCatalogue()).toMatchObject({ releaseDaysBefore: 3 });
    const state = fakeState({ order: orderView({ effectiveReleaseDaysBefore: null }) });
    const deps = fakeDeps(state);
    deps.clubSettings.mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null, releaseUnusedDaysBefore: null, allowMultiServiceOrders: false });
    const never = new ApiDataSource({ deps, today: TODAY });
    expect(await never.getCatalogue()).toMatchObject({ releaseDaysBefore: 0, releaseNever: true });
  });

  it('capability flags follow the signed-in user permissions', async () => {
    const both = await make(fakeState({ permissions: ['bookings.create', 'bookings.edit'] })).source.getCatalogue();
    expect(both.capabilities).toEqual({
      simulateBookings: false,
      logoUpload: false,
      realPublish: true,
      canBook: true,
      canEditBookings: true,
      canPlanClubs: true,
      mode: 'standard',
    });
    const read = await make(fakeState({ permissions: ['bookings.create'] })).source.getCatalogue();
    expect(read.capabilities).toMatchObject({ canBook: true, canEditBookings: false, canPlanClubs: false });
    const none = await make(fakeState({ permissions: [] })).source.getCatalogue();
    expect(none.capabilities).toMatchObject({ canBook: false, canEditBookings: false, canPlanClubs: false });
    const club = await make(fakeState(), editSession()).source.getCatalogue();
    expect(club.capabilities.mode).toBe('club');
  });

  it('lists the calendars of the order\'s služba for the board', async () => {
    const state = fakeState({ calendars: [{ ...fakeState().calendars[0]!, clinicServiceId: 'other' }, fakeState().calendars[1]!] });
    const { source } = make(state, newSession());
    expect((await source.getCalendars()).map((c) => c.id)).toEqual([CAL_B]);
    const { source: all } = make(state);
    expect((await all.getCalendars()).map((c) => c.id)).toEqual([CAL_A, CAL_B]);
  });
});

describe('standard terms', () => {
  it('two patients, same činnost and time, two calendars -> one term 2/2', async () => {
    const state = fakeState({ appointments: [appt('a1'), appt('a2', { calendarId: CAL_B })] });
    const { source } = make(state);
    const sessions = await source.listSessions(WEEK);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      date: '2026-11-04',
      start: '09:00',
      end: '09:30',
      categoryId: A_MEDICAL,
      capacity: 2,
      booked: 2,
      origin: 'public',
      appointmentIds: ['a1', 'a2'],
      calendarIds: [CAL_A, CAL_B],
    });
  });

  it('a lone patient is 1/1; a group booking counts its heads; cancelled and no-show are left out', async () => {
    const state = fakeState({
      appointments: [
        appt('lone', { startUtc: '2026-11-04T10:00:00Z', endUtc: '2026-11-04T10:30:00Z' }),
        appt('group', { startUtc: '2026-11-04T14:00:00Z', endUtc: '2026-11-04T14:30:00Z', headcount: 3 }),
        appt('gone', { startUtc: '2026-11-04T11:00:00Z', endUtc: '2026-11-04T11:30:00Z', status: 4 }),
        appt('absent', { startUtc: '2026-11-04T12:00:00Z', endUtc: '2026-11-04T12:30:00Z', status: 5 }),
      ],
    });
    const sessions = await make(state).source.listSessions(WEEK);
    expect(sessions.map((s) => [s.start, s.booked, s.capacity])).toEqual([
      ['11:00', 1, 1],
      ['15:00', 3, 3],
    ]);
  });

  it('parallel capacity: two patients in ONE calendar of a 2-parallel činnost fill 2 of 2, one patient is 1 of 2', async () => {
    const state = fakeState();
    state.activities = [{ ...state.activities[0]!, parallelCapacity: 2 }, state.activities[1]!];
    state.appointments = [appt('p1'), appt('p2'), appt('p3', { startUtc: '2026-11-05T08:00:00Z', endUtc: '2026-11-05T08:30:00Z' })];
    const sessions = await make(state).source.listSessions(WEEK);
    expect(sessions.map((s) => [s.date, s.booked, s.capacity])).toEqual([
      ['2026-11-04', 2, 2],
      ['2026-11-05', 1, 2],
    ]);
  });

  it('sums the price of the term: agreed price where the desk typed one, else the list price', async () => {
    const state = fakeState({
      appointments: [appt('a1', { agreedPriceCzk: 1200, listPriceCzk: 1500 }), appt('a2', { calendarId: CAL_B, agreedPriceCzk: null, listPriceCzk: 1500 })],
    });
    const [session] = await make(state).source.listSessions(WEEK);
    expect(session!.price).toEqual({ totalCzk: 2700, priced: 2, unpriced: 0, adjusted: true });
    expect(session!.appointments!.map((p) => p.priceCzk)).toEqual([1200, 1500]);
  });

  it('the term version changes when a booking changes', async () => {
    const state = fakeState({ appointments: [appt('a1')] });
    const { source } = make(state);
    const before = (await source.listSessions(WEEK))[0]!.version;
    state.appointments = [appt('a1', { startUtc: '2026-11-04T09:00:00Z', endUtc: '2026-11-04T09:30:00Z' })];
    const after = (await source.listSessions(WEEK))[0]!.version;
    expect(before).toBeTruthy();
    expect(after).not.toBe(before);
  });
});

describe('windows of other clubs', () => {
  const foreignState = () =>
    fakeState({
      blocks: { [CAL_B]: [timeBlock('tb-1', 'block-9')] },
      clubBlocks: [
        clubBlock('block-9', {
          clubId: 'club-9',
          clubName: 'SK Kladno',
          clubOrderId: 'order-9',
          calendarIds: [CAL_B],
          athletes: [athlete('s1', '2026-11-23T07:00:00Z'), athlete('s2', '2026-11-23T07:30:00Z'), athlete('s3', '2026-11-23T08:00:00Z', { status: 'Cancelled' })],
        }),
      ],
    });
  const DAY = { from: '2026-11-23', to: '2026-11-23' };

  it('without an order a club window is a club term: 600 min / 30 = 20 places, 2 registered', async () => {
    const [w] = await make(foreignState()).source.listSessions(DAY);
    expect(w).toMatchObject({
      id: 'club:block-9:2026-11-23:08:00',
      start: '08:00',
      end: '18:00',
      categoryId: A_MEDICAL,
      capacity: 20,
      booked: 2,
      origin: 'club',
      clubBooked: 2,
      clubBlockId: 'block-9',
      clubOrderId: 'order-9',
      clubName: 'SK Kladno',
      clubColorHex: '#aa3377',
      blockIds: ['tb-1'],
      calendarIds: [CAL_B],
      foreign: true,
    });
  });

  it('while an order is planned another club\'s window is busy time, never counted into the order', async () => {
    const { source } = make(foreignState(), newSession());
    const [w] = await source.listSessions(DAY);
    expect(w).toMatchObject({ origin: 'public', publicBooked: 2, clubBooked: 0, foreign: true });
    expect(await source.listOrderSessions()).toEqual([]);
  });

  it('a window appears on its own day only, however long the range asked for', async () => {
    const sessions = await make(foreignState()).source.listSessions({ from: '2026-11-20', to: '2026-11-27' });
    expect(sessions.map((s) => s.date)).toEqual(['2026-11-23']);
  });

  it('draws one window across the lunch break', async () => {
    const state = foreignState();
    state.blocks[CAL_B] = [
      timeBlock('tb-1', 'block-9', { startUtc: '2026-11-23T07:00:00Z', endUtc: '2026-11-23T11:00:00Z' }),
      timeBlock('tb-2', 'block-9', { startUtc: '2026-11-23T11:30:00Z', endUtc: '2026-11-23T17:00:00Z' }),
    ];
    const [w] = await make(state).source.listSessions(DAY);
    expect([w!.start, w!.end, w!.blockIds]).toEqual(['08:00', '18:00', ['tb-1', 'tb-2']]);
  });

  it('a club athlete\'s visit inside a window is not a booking of its own', async () => {
    const state = foreignState();
    state.appointments = [appt('ath', { calendarId: CAL_B, partnerName: 'SK Kladno', startUtc: '2026-11-23T07:00:00Z', endUtc: '2026-11-23T07:30:00Z' })];
    const sessions = await make(state).source.listSessions(DAY);
    expect(sessions.map((s) => s.id)).toEqual(['club:block-9:2026-11-23:08:00']);
  });
});

describe('the order being planned', () => {
  it('getOrder: seats per činnost, code, payment, status, club, windows, link', async () => {
    const { source } = make(fakeState(), editSession());
    const order = await source.getOrder();
    expect(order).toMatchObject({
      id: orderView().id,
      clubId: 'club-1',
      club: true,
      clubName: 'FK Slaný',
      serviceName: 'Sportovní prohlídky',
      code: ORDER_CODE,
      status: 'Confirmed',
      paymentMethod: 'ClubInvoice',
      totalSeats: 20,
      registered: 0,
      linkUrl: 'https://example.test/portal/abc',
      demands: [{ categoryId: A_MEDICAL, requested: 20, baselinePlanned: 0 }],
      baselineSessions: [],
      requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '18:00', activityIds: null }],
    });
  });

  it('a window is laid out as the server blocks it: the open hours without the lunch break, one term per piece', async () => {
    const order = orderView({
      blocks: [
        clubBlock('block-1', {
          registered: 3,
          athletes: [
            athlete('s1', '2026-11-23T07:00:00Z'),
            athlete('s2', '2026-11-23T07:30:00Z'),
            athlete('s3', '2026-11-23T09:00:00Z'),
            athlete('s4', '2026-11-23T09:30:00Z', { status: 'Cancelled' }),
          ],
        }),
      ],
    });
    const { source } = make(fakeState({ order }), editSession(order));
    const sessions = await source.listOrderSessions();
    expect(sessions.map((s) => [s.start, s.end, s.capacity, s.booked])).toEqual([
      ['08:00', '12:00', 8, 3],
      ['12:30', '18:00', 11, 0],
    ]);
    expect(sessions[0]).toMatchObject({
      id: 'own:block-1:2026-11-23:act-medical:08:00',
      date: '2026-11-23',
      categoryId: A_MEDICAL,
      booked: 3,
      clubBooked: 3,
      origin: 'club',
      clubBlockId: 'block-1',
      clubOrderId: order.id,
      calendarIds: [CAL_A],
      createdByPlanner: false,
    });
    // the shared calendar lists the same term once for its week
    const week = await source.listSessions({ from: '2026-11-23', to: '2026-11-29' });
    expect(week.filter((s) => s.origin === 'club')).toHaveLength(2);
  });

  it('a whole-day window (no hours) is the same two pieces; a closed day or one with no hours read gives none', async () => {
    const order = orderView({
      requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-25', dailyFrom: null, dailyTo: null, activityIds: null }],
      blocks: [clubBlock('block-1', { fromDate: '2026-11-23', toDate: '2026-11-25', dailyFrom: null, dailyTo: null })],
    });
    const state = fakeState({ order, previews: (_c, date) => (date === '2026-11-24' ? preview(date, { isOpen: false, closedBecause: 'notAWorkingDay' }) : preview(date)) });
    const { source } = make(state, editSession(order));
    expect((await source.listOrderSessions()).map((s) => [s.date, s.start, s.end])).toEqual([
      ['2026-11-23', '08:00', '12:00'],
      ['2026-11-23', '12:30', '18:00'],
      ['2026-11-25', '08:00', '12:00'],
      ['2026-11-25', '12:30', '18:00'],
    ]);
  });

  it('a window for several činnosti is laid out one after the other, piece by piece around the lunch break', async () => {
    const order = orderView({
      activitySeats: [
        { activityId: A_MEDICAL, activityName: 'Základní prohlídka', durationMinutes: 30, seats: 4, registered: 0, unitPriceCzk: 1500 },
        { activityId: A_SPIRO, activityName: 'Spiroergometrie', durationMinutes: 60, seats: 3, registered: 0, unitPriceCzk: 2400 },
      ],
      requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '14:00', activityIds: null }],
      blocks: [clubBlock('block-1', { dailyTo: '14:00', activityIds: [A_MEDICAL, A_SPIRO] })],
    });
    const session = editSession(order, {
      activities: [
        { activityId: A_MEDICAL, name: 'Základní prohlídka', seats: 4, minutesPerSeat: 30, parallelCapacity: 1 },
        { activityId: A_SPIRO, name: 'Spiroergometrie', seats: 3, minutesPerSeat: 60, parallelCapacity: 1 },
      ],
    });
    const { source } = make(fakeState({ order }), session);
    const sessions = await source.listOrderSessions();
    expect(sessions.map((s) => [s.categoryId, s.start, s.end, s.capacity])).toEqual([
      [A_MEDICAL, '08:00', '10:00', 4],
      [A_SPIRO, '10:00', '12:00', 2],
      [A_SPIRO, '12:30', '14:00', 1],
    ]);
  });

  it('a window of the order on a day the calendar is closed is not laid out', async () => {
    const order = orderView({
      requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-25', dailyFrom: '08:00', dailyTo: '10:00', activityIds: null }],
      blocks: [clubBlock('block-1', { fromDate: '2026-11-23', toDate: '2026-11-25', dailyTo: '10:00' })],
    });
    const state = fakeState({ order, previews: (_c, date) => (date === '2026-11-24' ? preview(date, { isOpen: false, closedBecause: 'notAWorkingDay' }) : preview(date)) });
    const { source } = make(state, editSession(order));
    expect((await source.listOrderSessions()).map((s) => s.date)).toEqual(['2026-11-23', '2026-11-25']);
  });

  it('a new order has an empty draft and no code', async () => {
    const { source } = make(fakeState(), newSession());
    expect(await source.listOrderSessions()).toEqual([]);
    expect(await source.getOrder()).toMatchObject({ id: '', code: null, status: 'New', demands: [{ categoryId: A_MEDICAL, requested: 20, baselinePlanned: 0 }] });
  });
});

describe('day marks and day budget', () => {
  it('a holiday is a closed day with its name; an ordinary day has the hours and the common lunch', async () => {
    const state = fakeState({
      holidays: [{ date: '2026-11-17', name: 'Den boje za svobodu a demokracii', isHoliday: true, isStatutory: true, isAmended: false }],
      previews: (_c, date) => (date === '2026-11-17' ? preview(date, { isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] }) : preview(date)),
    });
    const marks = await make(state).source.listDayMarks({ from: '2026-11-16', to: '2026-11-17' });
    expect(marks).toEqual([
      { date: '2026-11-16', closed: false, label: null, hours: { from: '08:00', to: '18:00' }, lunch: { from: '12:00', to: '12:30' } },
      { date: '2026-11-17', closed: true, label: 'Den boje za svobodu a demokracii', hours: null, lunch: null },
    ]);
  });

  it('the hours are the widest of the open calendars, the lunch only what all of them share', async () => {
    const state = fakeState({
      previews: (calendarId, date) =>
        calendarId === CAL_A ? preview(date) : preview(date, { startTime: '07:00', endTime: '15:00', breakStart: '12:15', breakEnd: '13:00' }),
    });
    const [mark] = await make(state).source.listDayMarks({ from: '2026-11-16', to: '2026-11-16' });
    expect(mark).toMatchObject({ hours: { from: '07:00', to: '18:00' }, lunch: { from: '12:15', to: '12:30' } });
  });

  it('the day is closed when every calendar is shut, even without a holiday', async () => {
    const state = fakeState({ previews: (_c, date) => preview(date, { isOpen: false, closedBecause: 'notAWorkingDay', offeredActivityIds: [] }) });
    const [mark] = await make(state).source.listDayMarks({ from: '2026-11-21', to: '2026-11-21' });
    expect(mark!.closed).toBe(true);
    expect(mark!.label).toBe('Nepracovní den');
  });

  it('the day budget is the longest working day of one calendar: 08:00-18:00 less a 30 min break = 570 min', async () => {
    const budget = await make().source.getDayBudget();
    expect(budget.defaultMinutes).toBe(570);
    expect(budget.byDate?.['2026-11-02']).toBe(570);
    const saved = await make().source.saveDayBudget(300);
    expect(saved.defaultMinutes).toBe(300);
    await expect(make().source.saveDayBudget(0)).rejects.toMatchObject({ code: 'validation' });
  });

  it('with no hours known the budget falls back to the grid\'s own span, not a literal', async () => {
    const state = fakeState({ previews: (_c, date) => preview(date, { isOpen: false }) });
    expect((await make(state).source.getDayBudget()).defaultMinutes).toBe(12 * 60);
  });
});

describe('the club', () => {
  it('maps the club card: leader = the first předseda / jednatel, contact, IČO / DIČ, address, colour', async () => {
    const { source } = make(fakeState(), editSession());
    expect(await source.getClubProfile()).toEqual({
      clubId: 'club-1',
      colorHex: '#2a7f62',
      clubName: 'FK Slaný',
      ico: '12345678',
      dic: 'CZ12345678',
      address: 'Smetanova 1, 274 01 Slaný',
      leaderName: 'Jan Novák',
      leaderEmail: 'jan@fkslany.cz',
      leaderPhone: '777 123 456',
      contactName: 'Eva Malá',
      contactEmail: 'eva@fkslany.cz',
      contactPhone: '777 987 654',
      logoUrl: null,
    });
  });

  it('the leader is the first member when nobody is a předseda or jednatel, and empty without management', async () => {
    const deps = fakeDeps();
    deps.club.mockResolvedValueOnce(club({ management: [{ id: 'm1', fullName: 'Petr Svoboda', role: 'sekretář', phone: null, email: null, source: 'manual' }] }));
    const first = await new ApiDataSource({ deps, session: editSession(), today: TODAY }).getClubProfile();
    expect(first).toMatchObject({ leaderName: 'Petr Svoboda', leaderEmail: '', leaderPhone: '' });
    deps.club.mockResolvedValueOnce(club({ management: [] }));
    const none = await new ApiDataSource({ deps, session: editSession(), today: TODAY }).getClubProfile();
    expect(none).toMatchObject({ leaderName: '', leaderEmail: '', leaderPhone: '' });
  });

  it('a club card without a colour takes the colour of its order (real data: the server colours the blocks)', async () => {
    const deps = fakeDeps();
    deps.club.mockResolvedValue(club({ colorHex: null }));
    const profile = await new ApiDataSource({ deps, session: editSession(), today: TODAY }).getClubProfile();
    expect(profile.colorHex).toBe('#2a7f62'); // orderView().clubColorHex
    const none = await new ApiDataSource({ deps, session: newSession(), today: TODAY }).getClubProfile();
    expect(none.colorHex).toBeNull();
  });

  it('standard booking shows the clinic, not a club', async () => {
    expect(await make().source.getClubProfile()).toMatchObject({ clubName: 'Klinika Test', ico: '' });
  });

  it('saves the header through the club update: whole card, management replaced with the edited leader', async () => {
    const { source, deps } = make(fakeState(), editSession());
    const saved = await source.saveClubProfile({ contactPhone: '+420 111 222 333', leaderName: 'Karel Nový', leaderEmail: '' });
    expect(deps.updateClub).toHaveBeenCalledTimes(1);
    const [id, body] = deps.updateClub.mock.calls[0]!;
    expect(id).toBe('club-1');
    expect(body).toMatchObject({
      name: 'FK Slaný',
      ico: '12345678',
      dic: 'CZ12345678',
      address: 'Smetanova 1',
      city: 'Slaný',
      postalCode: '274 01',
      contactPerson: 'Eva Malá',
      contactEmail: 'eva@fkslany.cz',
      contactPhone: '+420 111 222 333',
      paymentTermsDays: 14,
      isActive: true,
    });
    expect(body.management).toEqual([
      { id: 'm1', fullName: 'Petr Svoboda', role: 'místopředseda', phone: null, email: null, source: 'ares' },
      { id: 'm2', fullName: 'Karel Nový', role: 'předseda', phone: '777 123 456', email: null, source: 'ares' },
    ]);
    expect(saved.contactPhone).toBe('+420 111 222 333');
    expect(deps.invalidate).toHaveBeenCalled();
  });

  it('an edited address line overwrites the street and clears town and postal code (the header holds one line)', async () => {
    const { source, deps } = make(fakeState(), editSession());
    await source.saveClubProfile({ address: 'Nová 5, 110 00 Praha' });
    expect(deps.updateClub.mock.calls[0]![1]).toMatchObject({ address: 'Nová 5, 110 00 Praha', city: null, postalCode: null });
  });

  it('the logo has no field in the system: a clear refusal in Czech, nothing is invented', async () => {
    const { source } = make(fakeState(), editSession());
    await expect(source.saveLogo(new Blob(['x']))).rejects.toMatchObject({ code: 'forbidden', message: expect.stringContaining('Logo klubu') });
    expect((await source.getCatalogue()).capabilities.logoUpload).toBe(false);
  });

  it('a club failure is a PlannerWriteError with the server text', async () => {
    const { source, deps } = make(fakeState(), editSession());
    deps.updateClub.mockRejectedValueOnce(new BookingApiError('validation', 400, 'IČO je neplatné.'));
    await expect(source.saveClubProfile({ ico: '1' })).rejects.toMatchObject({ code: 'validation', message: 'IČO je neplatné.' });
  });
});

describe('the draft of the order\'s windows', () => {
  const seats24 = () => {
    const order = orderView({ activitySeats: [{ activityId: A_MEDICAL, activityName: 'Základní prohlídka', durationMinutes: 30, seats: 24, registered: 0, unitPriceCzk: 1500 }] });
    const session = editSession(order, { activities: [{ activityId: A_MEDICAL, name: 'Základní prohlídka', seats: 24, minutesPerSeat: 30, parallelCapacity: 1 }] });
    return { order, session };
  };

  it('createInterval adds to the draft only, calls no write, and can be undone', async () => {
    const { order, session } = seats24();
    const { source, deps } = make(fakeState({ order }), session);
    const created = await source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '09:00', quantity: 4 });
    expect(created.session).toMatchObject({ date: '2026-11-24', start: '09:00', end: '11:00', capacity: 4, origin: 'club', calendarIds: [CAL_A], clubOrderId: order.id });
    expect(created.complete).toBe(false); // 8 + 11 + 4 = 23 of 24
    expect((await source.listOrderSessions()).map((s) => [s.date, s.capacity])).toEqual([
      ['2026-11-23', 8],
      ['2026-11-23', 11],
      ['2026-11-24', 4],
    ]);
    for (const write of [deps.createStaffOrder, deps.updateOrder, deps.confirmOrder, deps.reschedule]) expect(write).not.toHaveBeenCalled();
    await source.undo(created.undoToken!);
    expect((await source.listOrderSessions()).map((s) => s.date)).toEqual(['2026-11-23', '2026-11-23']);
  });

  it('refuses a term over the order\'s seats and over a booking, with the model\'s Czech reason', async () => {
    const { order, session } = seats24();
    const state = fakeState({ order, appointments: [appt('busy', { startUtc: '2026-11-24T08:00:00Z', endUtc: '2026-11-24T08:30:00Z' })] });
    const { source } = make(state, session);
    await expect(source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '10:00', quantity: 6 })).rejects.toMatchObject({ code: 'validation', message: expect.stringContaining('Zbývá pouze 5') });
    await expect(source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '09:00', quantity: 2 })).rejects.toMatchObject({ code: 'validation', message: expect.stringContaining('překrývá') });
  });

  it('moveInterval moves the draft term and a stale version is refused', async () => {
    const { source } = make(fakeState(), editSession());
    const [term] = await source.listOrderSessions();
    await expect(source.moveInterval({ id: term!.id, date: '2026-11-24', start: '08:00', end: '12:00', expectedVersion: 'old' })).rejects.toMatchObject({ code: 'stale' });
    /* the clinic's lunch break (12:00-12:30 on that day) is never eaten by a moved term */
    await expect(source.moveInterval({ id: term!.id, date: '2026-11-24', start: '08:00', end: '18:00', expectedVersion: term!.version })).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining('polední pauzy') });
    const moved = await source.moveInterval({ id: term!.id, date: '2026-11-24', start: '08:00', end: '12:00', expectedVersion: term!.version });
    expect(moved.session).toMatchObject({ date: '2026-11-24', start: '08:00', end: '12:00' });
    expect(moved.session.version).not.toBe(term!.version);
  });

  it('another club\'s window and a lone booking cannot be edited here', async () => {
    const state = fakeState({
      blocks: { [CAL_B]: [timeBlock('tb-1', 'block-9')] },
      clubBlocks: [clubBlock('block-9', { clubId: 'club-9', clubName: 'SK Kladno', clubOrderId: 'order-9', calendarIds: [CAL_B] })],
      appointments: [appt('a1')],
    });
    const { source } = make(state, newSession());
    const [booking] = await source.listSessions({ from: '2026-11-04', to: '2026-11-04' });
    const [foreign] = await source.listSessions({ from: '2026-11-23', to: '2026-11-23' });
    await expect(source.deleteInterval(foreign!.id)).rejects.toMatchObject({ code: 'forbidden', message: expect.stringContaining('jiného klubu') });
    await expect(source.resizeInterval({ id: booking!.id, edge: 'bottom', start: '09:00', end: '10:00', added: 1 })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(source.deleteInterval(booking!.id)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(source.deleteInterval('nope')).rejects.toMatchObject({ code: 'notFound' });
  });

  it('createTerm is for club windows only: a booking is made in the booking dialog', async () => {
    await expect(make().source.createTerm({ date: '2026-11-24', categoryId: A_MEDICAL, start: '09:00', end: '10:00' })).rejects.toMatchObject({ code: 'forbidden' });
    const { source } = make(fakeState(), newSession());
    const made = await source.createTerm({ date: '2026-11-24', categoryId: A_MEDICAL, start: '09:00', end: '10:00' });
    expect(made.session).toMatchObject({ capacity: 2, start: '09:00', end: '10:00' });
  });
});

describe('finishPlan: ONE real call', () => {
  it('an untouched order is saved with exactly the ranges it has', async () => {
    const { source, deps } = make(fakeState(), editSession());
    const result = await source.finishPlan();
    expect(deps.updateOrder).toHaveBeenCalledTimes(1);
    expect(deps.updateOrder).toHaveBeenCalledWith(
      orderView().id,
      {
        activitySeats: [{ activityId: A_MEDICAL, seats: 20 }],
        paymentMethod: 'ClubInvoice',
        ranges: [{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '18:00' }],
        calendarIds: [CAL_A],
        note: '',
      },
      false,
    );
    // the window gives 8 + 11 = 19 places of the 20 ordered (the lunch break is not bookable): not ready, and said so
    expect(result).toEqual({ ready: false, orderId: orderView().id, orderCode: ORDER_CODE, windows: 1 });
    expect(deps.invalidate).toHaveBeenCalled();
  });

  it('a moved window and a new window are diffed into the update body', async () => {
    const order = orderView({ activitySeats: [{ activityId: A_MEDICAL, activityName: 'Základní prohlídka', durationMinutes: 30, seats: 24, registered: 0, unitPriceCzk: 1500 }] });
    const session = editSession(order, { activities: [{ activityId: A_MEDICAL, name: 'Základní prohlídka', seats: 24, minutesPerSeat: 30, parallelCapacity: 1 }], note: ' pozn. ' });
    const { source, deps } = make(fakeState({ order }), session);
    await source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '09:00', quantity: 4 });
    const result = await source.finishPlan();
    expect(deps.updateOrder).toHaveBeenCalledWith(
      order.id,
      {
        activitySeats: [{ activityId: A_MEDICAL, seats: 24 }],
        paymentMethod: 'ClubInvoice',
        ranges: [
          { fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '18:00' },
          { fromDate: '2026-11-24', toDate: '2026-11-24', dailyFrom: '09:00', dailyTo: '11:00' },
        ],
        calendarIds: [CAL_A],
        note: 'pozn.',
      },
      false,
    );
    expect(result.windows).toBe(2);
    expect(result.ready).toBe(false); // 8 + 11 + 4 = 23 of 24
  });

  it('moving one piece of a window rebuilds that window from its pieces; the draft is the only thing changed before finish', async () => {
    const { source, deps } = make(fakeState(), editSession());
    const [term] = await source.listOrderSessions();
    await source.moveInterval({ id: term!.id, date: '2026-11-24', start: '08:00', end: '12:00' });
    expect(deps.updateOrder).not.toHaveBeenCalled();
    await source.finishPlan();
    expect(deps.updateOrder.mock.calls[0]![1].ranges).toEqual([
      { fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '12:30', dailyTo: '18:00' },
      { fromDate: '2026-11-24', toDate: '2026-11-24', dailyFrom: '08:00', dailyTo: '12:00' },
    ]);
  });

  it('an untouched whole-day window goes back whole-day, never as 00:00-24:00', async () => {
    const order = orderView({
      requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-24', dailyFrom: null, dailyTo: null, activityIds: null }],
      blocks: [clubBlock('block-1', { toDate: '2026-11-24', dailyFrom: null, dailyTo: null })],
    });
    const { source, deps } = make(fakeState({ order }), editSession(order));
    await source.finishPlan();
    expect(deps.updateOrder.mock.calls[0]![1].ranges).toEqual([{ fromDate: '2026-11-23', toDate: '2026-11-24', dailyFrom: null, dailyTo: null }]);
  });

  it('windows of days gone by are not sent back, as in the pick mode of the calendar', async () => {
    const order = orderView({
      requestedRanges: [
        { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00', activityIds: null },
        { fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '12:00', activityIds: null },
      ],
      blocks: [
        clubBlock('block-old', { fromDate: '2026-10-26', toDate: '2026-10-26', dailyTo: '12:00' }),
        clubBlock('block-1', { dailyTo: '12:00' }),
      ],
    });
    const { source, deps } = make(fakeState({ order }), editSession(order));
    await source.finishPlan();
    expect(deps.updateOrder.mock.calls[0]![1].ranges).toEqual([{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '12:00' }]);
  });

  it('a window for several činnosti that was touched becomes one window per činnost (activityIds), an untouched one is kept', async () => {
    const order = orderView({
      activitySeats: [
        { activityId: A_MEDICAL, activityName: 'Základní prohlídka', durationMinutes: 30, seats: 4, registered: 0, unitPriceCzk: 1500 },
        { activityId: A_SPIRO, activityName: 'Spiroergometrie', durationMinutes: 60, seats: 3, registered: 0, unitPriceCzk: 2400 },
      ],
      requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '14:00', activityIds: null }],
      blocks: [clubBlock('block-1', { dailyTo: '14:00', activityIds: [A_MEDICAL, A_SPIRO] })],
    });
    const session = editSession(order, {
      activities: [
        { activityId: A_MEDICAL, name: 'Základní prohlídka', seats: 4, minutesPerSeat: 30, parallelCapacity: 1 },
        { activityId: A_SPIRO, name: 'Spiroergometrie', seats: 3, minutesPerSeat: 60, parallelCapacity: 1 },
      ],
    });
    const untouched = make(fakeState({ order }), session);
    await untouched.source.finishPlan();
    expect(untouched.deps.updateOrder.mock.calls[0]![1].ranges).toEqual([{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '14:00' }]);

    const touched = make(fakeState({ order }), session);
    const spiro = (await touched.source.listOrderSessions()).find((s) => s.categoryId === A_SPIRO)!;
    await touched.source.moveInterval({ id: spiro.id, date: '2026-11-24', start: '10:00', end: '12:00' });
    await touched.source.finishPlan();
    expect(touched.deps.updateOrder.mock.calls[0]![1].ranges).toEqual([
      { fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '10:00', activityIds: [A_MEDICAL] },
      { fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '12:30', dailyTo: '14:00', activityIds: [A_SPIRO] },
      { fromDate: '2026-11-24', toDate: '2026-11-24', dailyFrom: '10:00', dailyTo: '12:00', activityIds: [A_SPIRO] },
    ]);
  });

  it('409 with athletes: nothing is cancelled until the desk confirms, then the SAME write repeats with the flag', async () => {
    const { source, deps } = make(fakeState(), editSession());
    const [term] = await source.listOrderSessions();
    await source.moveInterval({ id: term!.id, date: '2026-11-24', start: '08:00', end: '12:00' });
    deps.updateOrder.mockRejectedValueOnce(
      new ClubOrderError('Změna se dotkne přihlášených sportovců.', 409, 'club_order.athletes_affected', [
        { name: 'Jan Sportovec', activityName: 'Základní prohlídka', reason: 'activity_removed_from_window' },
      ]),
    );
    const failure = await source.finishPlan().catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(PlannerWriteError);
    expect(failure).toMatchObject({
      code: 'conflict',
      message: 'Změna se dotkne přihlášených sportovců.',
      affectedAthletes: [{ name: 'Jan Sportovec', activityName: 'Základní prohlídka', reason: 'activity_removed_from_window' }],
    });
    expect(deps.updateOrder.mock.calls[0]![2]).toBe(false);
    // the draft survived the refusal
    expect((await source.listOrderSessions())[0]!.date).toBe('2026-11-24');
    await source.finishPlan({ cancelAffectedAthletes: true });
    expect(deps.updateOrder).toHaveBeenCalledTimes(2);
    expect(deps.updateOrder.mock.calls[1]![2]).toBe(true);
    expect(deps.updateOrder.mock.calls[1]![1]).toEqual(deps.updateOrder.mock.calls[0]![1]);
  });

  it('a new order is created with one createStaff call after the duplicate check; it is then the order being edited', async () => {
    const { source, deps } = make(fakeState(), newSession());
    /* 16 slots from 08:00 cross the lunch break (12:00-12:30): 8 before it and 8 after it, never a block over it */
    await source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '08:00', quantity: 16 });
    await source.createInterval({ date: '2026-11-25', categoryId: A_MEDICAL, start: '08:00', quantity: 4 });
    const result = await source.finishPlan();
    expect(deps.clubOrders).toHaveBeenCalledWith('club-1');
    expect(deps.createStaffOrder).toHaveBeenCalledTimes(1);
    expect(deps.createStaffOrder).toHaveBeenCalledWith({
      clubId: 'club-1',
      serviceId: SVC,
      activitySeats: [{ activityId: A_MEDICAL, seats: 20 }],
      paymentMethod: 'ClubInvoice',
      ranges: [
        { fromDate: '2026-11-24', toDate: '2026-11-24', dailyFrom: '08:00', dailyTo: '12:00' },
        { fromDate: '2026-11-24', toDate: '2026-11-24', dailyFrom: '12:30', dailyTo: '16:30' },
        { fromDate: '2026-11-25', toDate: '2026-11-25', dailyFrom: '08:00', dailyTo: '10:00' },
      ],
      calendarIds: [CAL_A],
      status: 'Confirmed',
    });
    expect(result).toMatchObject({ ready: true, orderId: orderView().id, orderCode: ORDER_CODE });
    expect((await source.getOrder()).id).toBe(orderView().id);
  });

  it('the club already has a live order: the desk decides, nothing is created silently', async () => {
    const state = fakeState({ liveOrders: [orderView({ id: '0199c0de-0000-7000-8000-00000000ffff', serviceId: 'svc-other', serviceName: 'Jiná služba' })] });
    const { source, deps } = make(state, newSession());
    /* 16 slots from 08:00 cross the lunch break (12:00-12:30): 8 before it and 8 after it, never a block over it */
    await source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '08:00', quantity: 16 });
    await source.createInterval({ date: '2026-11-25', categoryId: A_MEDICAL, start: '08:00', quantity: 4 });
    const failure = await source.finishPlan().catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(PlannerDuplicateOrderError);
    expect((failure as PlannerDuplicateOrderError).liveOrders).toEqual([
      { id: '0199c0de-0000-7000-8000-00000000ffff', code: 'KO-0000FFFF', serviceName: 'Jiná služba', status: 'Confirmed', sameService: false },
    ]);
    expect(deps.createStaffOrder).not.toHaveBeenCalled();
    await source.finishPlan({ skipDuplicateCheck: true });
    expect(deps.createStaffOrder).toHaveBeenCalledTimes(1);
  });

  it('an addendum goes to the group without the duplicate question', async () => {
    const state = fakeState({ liveOrders: [orderView()] });
    const { source, deps } = make(state, newSession({ parentOrderId: 'root-1' }));
    /* 16 slots from 08:00 cross the lunch break (12:00-12:30): 8 before it and 8 after it, never a block over it */
    await source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '08:00', quantity: 16 });
    await source.createInterval({ date: '2026-11-25', categoryId: A_MEDICAL, start: '08:00', quantity: 4 });
    await source.finishPlan();
    expect(deps.clubOrders).not.toHaveBeenCalled();
    expect(deps.createStaffOrder.mock.calls[0]![0]).toMatchObject({ parentOrderId: 'root-1' });
  });

  it('processing a club\'s request: save the changed seats first, then confirm with the ranges', async () => {
    const order = orderView({ status: 'Requested' });
    const session = editSession(order);
    session.editOrder = { ...session.editOrder!, mode: 'process', dirty: true, blocks: [] };
    const { source, deps } = make(fakeState({ order }), session);
    await source.finishPlan();
    expect(deps.updateOrder).toHaveBeenCalledWith(order.id, { activitySeats: [{ activityId: A_MEDICAL, seats: 20 }], paymentMethod: 'ClubInvoice', note: '' }, false);
    expect(deps.confirmOrder).toHaveBeenCalledWith(order.id, {
      calendarIds: [CAL_A],
      ranges: [{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '18:00' }],
    });
  });

  it('nothing planned -> nothing is sent; standard booking has nothing to finish', async () => {
    const { source, deps } = make(fakeState(), newSession());
    await expect(source.finishPlan()).rejects.toMatchObject({ code: 'validation' });
    expect(deps.createStaffOrder).not.toHaveBeenCalled();
    await expect(make().source.finishPlan()).rejects.toMatchObject({ code: 'validation' });
  });

  it('a refusal of the save keeps the plan and reads as Czech', async () => {
    const { source, deps } = make(fakeState(), editSession());
    deps.updateOrder.mockRejectedValueOnce(new ClubOrderError('Čas je obsazen.', 409));
    await expect(source.finishPlan()).rejects.toMatchObject({ code: 'conflict', message: 'Čas je obsazen.', affectedAthletes: [] });
    deps.updateOrder.mockRejectedValueOnce(new Error('boom'));
    await expect(source.finishPlan()).rejects.toMatchObject({ code: 'unknown', message: expect.stringContaining('Objednávku se nepodařilo uložit') });
    expect(await source.listOrderSessions()).toHaveLength(2);
  });

  it('publishForm: an existing order gives its link, a new one is invited once and then is the order being edited', async () => {
    const existing = make(fakeState(), editSession());
    expect(await existing.source.publishForm()).toEqual({ url: 'https://example.test/portal/abc', generated: true });
    expect(existing.deps.inviteClub).not.toHaveBeenCalled();

    const fresh = make(fakeState(), newSession());
    expect(await fresh.source.publishForm()).toEqual({ url: 'https://example.test/portal/abc', generated: true });
    expect(await fresh.source.publishForm()).toEqual({ url: 'https://example.test/portal/abc', generated: true });
    expect(fresh.deps.inviteClub).toHaveBeenCalledTimes(1);
    expect(fresh.deps.inviteClub).toHaveBeenCalledWith({ clubId: 'club-1', serviceId: SVC });
  });
});

describe('moving a booking of a patient', () => {
  const two = () => fakeState({ appointments: [appt('a1'), appt('a2', { calendarId: CAL_B })] });
  const TO = new Date('2026-11-05T09:00:00Z'); // 10:00 Prague

  it('moves every booking of the term through the existing reschedule, with the notify choice', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    const moved = await source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30', expectedVersion: term!.version, notifyPatient: false });
    expect(deps.reschedule).toHaveBeenCalledTimes(2);
    expect(deps.reschedule).toHaveBeenNthCalledWith(1, CAL_A, 'a1', TO, undefined, { notifyPatient: false, ifMatch: 'tok-a1' });
    expect(deps.reschedule).toHaveBeenNthCalledWith(2, CAL_B, 'a2', TO, undefined, { notifyPatient: false, ifMatch: 'tok-a2' });
    expect(moved.session).toMatchObject({ date: '2026-11-05', start: '10:00', end: '10:30' });
    expect(moved.notified).toEqual({ clubLinkUpdated: false, individuals: 0 });
    expect(deps.invalidate).toHaveBeenCalled();
  });

  it('absent notify leaves the server\'s own rule (no body)', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    const moved = await source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30' });
    expect(deps.reschedule).toHaveBeenNthCalledWith(1, CAL_A, 'a1', TO, undefined, { ifMatch: 'tok-a1' });
    expect(moved.notified.individuals).toBe(2);
  });

  it('the server says who was told: a walk-in has nobody, a patient with an e-mail is told', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    deps.reschedule.mockResolvedValueOnce({ patientNotified: true, reason: null }).mockResolvedValueOnce({ patientNotified: false, reason: 'no_patient' });
    const moved = await source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30' });
    expect(moved.notified).toEqual({ clubLinkUpdated: false, individuals: 1 });
  });

  it('a booking that changed since the desk read it -> stale, nothing is written', async () => {
    const state = two();
    const { source, deps } = make(state);
    const [term] = await source.listSessions(WEEK);
    state.appointments[0] = appt('a1', { startUtc: '2026-11-04T09:00:00Z', endUtc: '2026-11-04T09:30:00Z' }); // someone moved it
    await expect(source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30', expectedVersion: term!.version })).rejects.toMatchObject({
      code: 'stale',
      message: expect.stringContaining('mezitím změnil'),
    });
    expect(deps.reschedule).not.toHaveBeenCalled();
  });

  it('a 412 from the server is stale, a 409 is a conflict with the server text, and the first booking is put back', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    deps.reschedule.mockRejectedValueOnce(new BookingApiError('server', 412));
    await expect(source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30' })).rejects.toMatchObject({ code: 'stale' });

    deps.reschedule.mockReset();
    deps.reschedule.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new BookingApiError('conflict', 409, 'Čas je obsazen.')).mockResolvedValue(undefined);
    await expect(source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30' })).rejects.toMatchObject({ code: 'conflict', message: 'Čas je obsazen.' });
    expect(deps.reschedule).toHaveBeenCalledTimes(3);
    expect(deps.reschedule).toHaveBeenNthCalledWith(3, CAL_A, 'a1', '2026-11-04T08:00:00Z', undefined, { notifyPatient: false });
  });

  it('undo puts the bookings back where they were and tells the patient as the move did', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    const moved = await source.moveInterval({ id: term!.id, date: '2026-11-05', start: '10:00', end: '10:30', notifyPatient: true });
    deps.reschedule.mockClear();
    await source.undo(moved.undoToken!);
    expect(deps.reschedule).toHaveBeenCalledTimes(2);
    expect(deps.reschedule).toHaveBeenCalledWith(CAL_B, 'a2', '2026-11-04T08:00:00Z', undefined, { notifyPatient: true });
    expect(deps.reschedule).toHaveBeenCalledWith(CAL_A, 'a1', '2026-11-04T08:00:00Z', undefined, { notifyPatient: true });
    await expect(source.undo(moved.undoToken!)).rejects.toMatchObject({ code: 'notFound' });
  });

  it('the same time again changes nothing', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    const same = await source.moveInterval({ id: term!.id, date: '2026-11-04', start: '09:00', end: '09:30' });
    expect(deps.reschedule).not.toHaveBeenCalled();
    expect(same.undoToken).toBeNull();
  });

  it('the smart editor on a booking may change date and time only', async () => {
    const { source, deps } = make(two());
    const [term] = await source.listSessions(WEEK);
    await expect(source.updateInterval({ id: term!.id, date: '2026-11-05', categoryId: A_SPIRO, start: '10:00', end: '10:30', capacity: 2 })).rejects.toMatchObject({ code: 'forbidden' });
    await source.updateInterval({ id: term!.id, date: '2026-11-05', categoryId: A_MEDICAL, start: '10:00', end: '10:30', capacity: 2 });
    expect(deps.reschedule).toHaveBeenCalledTimes(2);
  });
});

describe('subscribers', () => {
  it('are told after an own write, not after a read', async () => {
    const { source } = make(fakeState(), newSession());
    let calls = 0;
    const off = source.subscribe!(() => (calls += 1));
    await source.getCatalogue();
    expect(calls).toBe(0);
    await source.createInterval({ date: '2026-11-24', categoryId: A_MEDICAL, start: '08:00', quantity: 2 });
    expect(calls).toBe(1);
    off();
    await source.createInterval({ date: '2026-11-25', categoryId: A_MEDICAL, start: '08:00', quantity: 2 });
    expect(calls).toBe(1);
  });
});
