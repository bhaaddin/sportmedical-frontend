import { describe, expect, it, vi } from 'vitest';
import { totals, plannedOf, buildPlannerContext_forTest } from './testSupport';
import { DemoDataSource } from './DemoDataSource';
import { PlannerWriteError, mergeSessions, plannerKeys } from './PlannerDataSource';
import { demoCategories, demoSessions } from './demoFixtures';

const TODAY = '2026-11-10';
const make = (options = {}) => {
  let n = 0;
  return new DemoDataSource({ today: TODAY, newId: () => `NEW${n++}`, ...options });
};

describe('reads', () => {
  it('serves the catalogue, order, profile and budget', async () => {
    const s = make();
    const cat = await s.getCatalogue();
    expect(cat.categories.map((c) => c.id)).toEqual(demoCategories.map((c) => c.id));
    expect(cat.window).toEqual({ startMinutes: 420, endMinutes: 1140 });
    expect(cat.capabilities).toEqual({ simulateBookings: true, logoUpload: true, realPublish: false });
    expect(cat.releaseDaysBefore).toBe(7);
    const order = await s.getOrder();
    expect(order.demands.map((d) => d.categoryId)).toEqual(['medical', 'movement', 'fitness', 'physio', 'vo2', 'performance']);
    expect(order.baselineSessions).toHaveLength(18);
    expect((await s.getClubProfile()).clubName).toBe('RC Mountfield Říčany');
    expect(await s.getDayBudget()).toEqual({ defaultMinutes: 720 });
  });
  it('filters sessions by range and returns copies', async () => {
    const s = make();
    const week = await s.listSessions({ from: '2026-11-16', to: '2026-11-22' });
    expect(week.map((x) => x.id)).toEqual(
      demoSessions.filter((x) => x.date >= '2026-11-16' && x.date <= '2026-11-22').map((x) => x.id),
    );
    week[0]!.capacity = 999;
    expect((await s.listSessions({ from: '2026-11-16', to: '2026-11-22' }))[0]!.capacity).not.toBe(999);
    expect(await s.listSessions({ from: '2027-01-01', to: '2027-01-31' })).toEqual([]);
  });
  it('lists only the club terms as the order terms', async () => {
    const s = make();
    expect((await s.listOrderSessions()).map((x) => x.id)).toEqual(['m1', 'a1', 'm2', 'f1', 'm3', 'x1']);
  });
  it('marks days: weekdays have hours and lunch, weekends none, one demo closure', async () => {
    const marks = await make().listDayMarks({ from: '2026-11-20', to: '2026-11-26' });
    expect(marks).toHaveLength(7);
    expect(marks[0]).toMatchObject({ date: '2026-11-20', closed: false, hours: { from: '07:00', to: '19:00' }, lunch: { from: '12:00', to: '12:30' } });
    expect(marks[1]).toMatchObject({ date: '2026-11-21', hours: null });
    expect(marks[6]).toMatchObject({ date: '2026-11-26', closed: true, label: 'Zavřeno (ukázka)' });
  });
  it('keeps the helper that merges lists stable and chronological', () => {
    const a = [{ ...demoSessions[0]!, capacity: 1 }];
    const merged = mergeSessions(a, demoSessions);
    expect(merged.find((x) => x.id === 'm1')!.capacity).toBe(12);
    expect(merged.map((x) => x.date + x.start)).toEqual([...merged.map((x) => x.date + x.start)].sort());
    expect(plannerKeys.sessions('demo', { from: 'a', to: 'b' })).toEqual(['planner', 'demo', 'sessions', 'a', 'b']);
  });
});

describe('writes', () => {
  it('creates and merges an interval, notifies, stamps a version, and undoes it', async () => {
    const s = make();
    const listener = vi.fn();
    s.subscribe(listener);
    const first = await s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '09:00', quantity: 3 });
    expect(first).toMatchObject({ mergedCount: 0, complete: false, removedIds: [] });
    expect(first.session).toMatchObject({ id: 'NEW0', start: '09:00', end: '10:00', capacity: 3, version: '1' });
    expect(listener).toHaveBeenCalledTimes(1);
    const second = await s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '10:00', quantity: 3 });
    expect(second).toMatchObject({ mergedCount: 1, removedIds: ['NEW0'] });
    expect(second.session).toMatchObject({ id: 'NEW0', start: '09:00', end: '11:00', capacity: 6 });
    expect((await s.listSessions({ from: '2026-11-25', to: '2026-11-25' }))).toHaveLength(1);
    await s.undo(second.undoToken!);
    const back = await s.listSessions({ from: '2026-11-25', to: '2026-11-25' });
    expect(back.map((x) => [x.id, x.end, x.capacity])).toEqual([['NEW0', '10:00', 3]]);
    await expect(s.undo(second.undoToken!)).rejects.toMatchObject({ code: 'notFound' });
  });
  it('refuses what the rules refuse, with the Czech reason', async () => {
    const s = make();
    const err = await s.createInterval({ date: '2026-11-18', categoryId: 'physio', start: '09:30', quantity: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(PlannerWriteError);
    expect(err).toMatchObject({ code: 'validation', message: 'Čas se překrývá s již vytvořeným termínem.' });
    await expect(s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '07:00', quantity: 25 })).rejects.toMatchObject({
      message: 'Zbývá pouze 24 osob. Zkraťte časový úsek.',
    });
  });
  it('creates a term from the dialog', async () => {
    const s = make();
    const r = await s.createTerm({ date: '2026-11-25', categoryId: 'physio', start: '09:00', end: '10:30' });
    expect(r.session).toMatchObject({ id: 'NEW0', capacity: 3 });
    await expect(s.createTerm({ date: '2026-11-25', categoryId: 'physio', start: '09:00', end: '10:10' })).rejects.toMatchObject({ code: 'validation' });
  });
  it('moves a term, shifting its slots, and reports who must be told', async () => {
    const s = make();
    const planted = await s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '09:00', quantity: 3 });
    const moved = await s.moveInterval({ id: planted.session.id, date: '2026-11-27', start: '11:00', end: '12:00', expectedVersion: planted.session.version });
    expect(moved.session).toMatchObject({ date: '2026-11-27', start: '11:00', end: '12:00' });
    expect(moved.session.slots?.[0]).toMatchObject({ start: '11:00', end: '11:20' });
    expect(moved.notified).toEqual({ clubLinkUpdated: true, individuals: 0 });
    expect(moved.session.version).not.toBe(planted.session.version);
    await expect(s.moveInterval({ id: 'm1', date: '2026-11-18', start: '10:30', end: '12:30' })).rejects.toMatchObject({ code: 'conflict' });
    await expect(s.moveInterval({ id: 'zzz', date: '2026-11-18', start: '10:30', end: '12:30' })).rejects.toMatchObject({ code: 'notFound' });
  });
  it('rejects a write made on an outdated version', async () => {
    const s = make();
    const planted = await s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '09:00', quantity: 3 });
    await s.moveInterval({ id: planted.session.id, date: '2026-11-26', start: '09:00', end: '10:00' });
    const stale = await s.moveInterval({ id: planted.session.id, date: '2026-11-27', start: '09:00', end: '10:00', expectedVersion: planted.session.version }).catch((e) => e);
    expect(stale).toMatchObject({ code: 'stale' });
    await expect(s.resizeInterval({ id: planted.session.id, edge: 'bottom', start: '09:00', end: '10:20', added: 1, expectedVersion: planted.session.version })).rejects.toMatchObject({ code: 'stale' });
    await expect(s.updateInterval({ id: planted.session.id, date: '2026-11-26', categoryId: 'medical', start: '09:00', end: '10:20', capacity: 4, expectedVersion: planted.session.version })).rejects.toMatchObject({ code: 'stale' });
  });
  it('expands a term at either edge without rewriting existing slots', async () => {
    const s = make();
    const planted = await s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '09:00', quantity: 3 });
    const down = await s.resizeInterval({ id: planted.session.id, edge: 'bottom', start: '09:00', end: '10:40', added: 2 });
    expect(down.session).toMatchObject({ capacity: 5, end: '10:40' });
    expect(down.session.slots).toHaveLength(5);
    const up = await s.resizeInterval({ id: planted.session.id, edge: 'top', start: '08:40', end: '10:40', added: 1 });
    expect(up.session).toMatchObject({ capacity: 6, start: '08:40' });
    expect(up.session.slots![1]!.start).toBe('09:00');
    await expect(s.resizeInterval({ id: planted.session.id, edge: 'bottom', start: '08:40', end: '19:20', added: 28 })).rejects.toMatchObject({ code: 'validation' });
  });
  it('updates date, činnost and capacity through the smart editor rules', async () => {
    const s = make();
    const planted = await s.createInterval({ date: '2026-11-25', categoryId: 'medical', start: '09:00', quantity: 3 });
    const r = await s.updateInterval({ id: planted.session.id, date: '2026-11-26', categoryId: 'physio', start: '08:00', end: '09:30', capacity: 3 });
    expect(r.session).toMatchObject({ date: '2026-11-26', categoryId: 'physio', capacity: 3, end: '09:30', slotDuration: 30 });
    await expect(s.updateInterval({ id: planted.session.id, date: '2026-11-26', categoryId: 'physio', start: '08:00', end: '09:40', capacity: 3 })).rejects.toMatchObject({ code: 'validation' });
  });
  it('deletes and undoes', async () => {
    const s = make();
    const { undoToken } = await s.deleteInterval('m3');
    expect((await s.listOrderSessions()).map((x) => x.id)).not.toContain('m3');
    await s.undo(undoToken!);
    expect((await s.listOrderSessions()).map((x) => x.id)).toContain('m3');
    await expect(s.deleteInterval('zzz')).rejects.toMatchObject({ code: 'notFound' });
  });
  it('keeps only as many undo snapshots as configured', async () => {
    const s = make({ maxUndo: 2 });
    const a = await s.deleteInterval('m3');
    await s.deleteInterval('m2');
    await s.deleteInterval('m1');
    await expect(s.undo(a.undoToken!)).rejects.toMatchObject({ code: 'notFound' });
  });
});

describe('profile, plan and settings', () => {
  it('saves a trimmed profile and a logo', async () => {
    const s = make();
    const saved = await s.saveClubProfile({ ico: ' 123 ', contactName: ' Jana ', contactEmail: 'jana@example.test' });
    expect(saved).toMatchObject({ ico: '123', contactName: 'Jana', contactEmail: 'jana@example.test' });
    const withLogo = await s.saveLogo(new Blob(['x'], { type: 'image/png' }));
    expect(withLogo.logoUrl).toMatch(/^data:image\/png;base64,/);
    expect((await s.getClubProfile()).logoUrl).toBe(withLogo.logoUrl);
  });
  it('finishes the plan only when everything is planned and a contact exists', async () => {
    const s = make();
    expect(await s.finishPlan()).toEqual({ ready: false });
    expect(s.isPlanCompleted).toBe(false);
    const full = make({ sessions: [] });
    expect(await full.finishPlan()).toEqual({ ready: false });
  });
  it('generates the form link and stores the day budget', async () => {
    const s = make();
    expect(await s.publishForm()).toEqual({ url: null, generated: true });
    expect(await s.saveDayBudget(480)).toEqual({ defaultMinutes: 480 });
    await expect(s.saveDayBudget(0)).rejects.toMatchObject({ code: 'validation' });
  });
  it('simulates bookings and the release', async () => {
    const s = make();
    const planted = await s.createInterval({ date: '2026-12-10', categoryId: 'medical', start: '09:00', quantity: 3 });
    const r = await s.addBooking(planted.session.id, 'club');
    expect(r.message).toBe('Demo: přidána rezervace sportovce klubu');
    await expect(s.addBooking(planted.session.id, 'public')).rejects.toMatchObject({ code: 'validation' });
    expect((await s.releaseDay('2026-12-10')).message).toBe('Demo: zbývající klubové blokace jsou nyní veřejně dostupné.');
    expect((await s.addBooking(planted.session.id, 'public')).message).toBe('Demo: přidána veřejná rezervace');
  });
});

describe('test hooks', () => {
  it('fails the next call and delays calls on request', async () => {
    const s = make();
    s.failNext(new Error('boom'));
    await expect(s.getCatalogue()).rejects.toThrow('boom');
    await expect(s.getCatalogue()).resolves.toBeDefined();
    vi.useFakeTimers();
    s.setLatency(50);
    const pending = s.getOrder();
    let done = false;
    void pending.then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(49);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
  it('builds the same context as the pure model reads', async () => {
    const s = make();
    const ctx = await buildPlannerContext_forTest(s);
    expect(totals(ctx)).toEqual({ requested: 378, planned: 252, pending: 126, percent: 67 });
    expect(plannedOf(ctx, 'medical')).toBe(48);
  });
});
