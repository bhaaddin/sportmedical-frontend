/*
 * ApiDataSource against the REAL dev API (not part of the normal run).
 *
 *   PLANNER_REAL=1 VITE_API_BASE_URL=http://localhost:3000 LOGIN_FILE=C:/.../.dev-login.txt npx vitest run src/planner/data/ApiDataSource.real.test.ts
 *
 * (3000 is the Vite dev server, which proxies /api to the API; jsdom's own origin is the same, so no CORS.)
 *
 * It signs in with the throwaway dev login, creates its OWN test club, orders and bookings (every name starts with
 * "ZZ PL-F"), exercises the write paths through the data source, and in `afterAll` cancels / deactivates exactly what
 * it created. It never touches anything else. Dates are in December 2026, far from the seeded data.
 */
import fs from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { appointmentsApi } from '../../api/appointments';
import client from '../../api/client';
import { clubBlocksApi, fetchBlockableActivities } from '../../api/clubBlocks';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { clubsApi, type Club } from '../../api/clubs';
import { editSessionFor } from '../../components/clubs/order/editSession';
import type { PickSession } from '../../components/clubs/order/pickSession';
import { defaultApiDeps } from '../api/deps';
import { toWriteError } from '../api/errors';
import { ApiDataSource, PlannerDuplicateOrderError } from './ApiDataSource';
import { PlannerWriteError } from './PlannerDataSource';

const REAL = Boolean(process.env.PLANNER_REAL);
const API = 'http://localhost:5092';
const TODAY = '2026-10-18';

/* The seeded dev clinic: "Ordinace 1" (calendar), its služba and one of its činnosti (40 min). Looked up by name below. */
let CAL = '';
let SVC = '';
let ACT = '';
let ACT_NAME = '';

const sent: number[] = [];
let paced = 0;
let total = 0;
const cost = (step: string) => note(`requests after "${step}"`, { total, pacedSeconds: paced });

const created = { club: null as Club | null, orders: [] as string[], appointments: [] as { calendarId: string; id: string }[] };
const note = (label: string, value: unknown) => {
  const line = `[real] ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
  console.log(line);
  if (process.env.REAL_LOG) fs.appendFileSync(process.env.REAL_LOG, `${line}\n`);
};

async function signIn() {
  const lines = fs.readFileSync(process.env.LOGIN_FILE as string, 'utf8').split(/\r?\n/);
  const val = (k: string) => lines.find((l) => l.toLowerCase().startsWith(k))?.split(/:\s+/)[1]?.trim();
  const r = await fetch(`${API}/api/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: val('e-mail'), password: val('password') }) });
  const j = (await r.json()) as { value?: Record<string, unknown> } & Record<string, unknown>;
  const v = (j.value ?? j) as { token?: string; accessToken?: string; permissions?: string[] };
  localStorage.setItem('token', (v.token ?? v.accessToken) as string);
  localStorage.setItem('permissions', JSON.stringify(v.permissions ?? []));
}

const source = (session: PickSession | null, extra: Partial<ConstructorParameters<typeof ApiDataSource>[0]> = {}) =>
  new ApiDataSource({ deps: defaultApiDeps(null), session, today: TODAY, ...extra });

const editSessionOf = async (orderId: string, activitiesPatch?: (s: PickSession) => PickSession): Promise<PickSession> => {
  const order = await clubOrdersApi.get(orderId);
  const session = editSessionFor(order, await fetchBlockableActivities(), TODAY);
  return activitiesPatch ? activitiesPatch(session) : session;
};

const newSessionOf = (seats: number): PickSession => ({
  clubId: created.club!.id,
  clubName: created.club!.name,
  serviceId: SVC,
  serviceName: 'Sportovní lékařské prohlídky',
  activities: [{ activityId: ACT, name: ACT_NAME, seats, minutesPerSeat: 40, parallelCapacity: 1 }],
  paymentMethod: 'ClubInvoice',
  note: 'ZZ PL-F test',
});

const rangesOf = (o: ClubOrderView) => o.requestedRanges.map((r) => `${r.fromDate}${r.toDate !== r.fromDate ? `..${r.toDate}` : ''} ${r.dailyFrom ?? '-'}-${r.dailyTo ?? '-'}`);

describe.skipIf(!REAL)('ApiDataSource against the real dev API', () => {
  beforeAll(async () => {
    await signIn();
    /* Slow or failed calls are logged: the one real-API hang this file once found was a request that never answered. */
    /* The API allows 100 calls a minute per session and queues the rest (Program.cs, policy "api"): the test paces
       itself below that and counts what each step costs, so a chatty data source shows up as "paced". */
    client.interceptors.request.use(async (c) => {
      while (true) {
        const now = Date.now();
        while (sent.length > 0 && now - sent[0]! > 60_000) sent.shift();
        if (sent.length < 90) break;
        paced += 1;
        await new Promise((r) => setTimeout(r, 1000));
      }
      sent.push(Date.now());
      total += 1;
      (c as { __t?: number }).__t = Date.now();
      return c;
    });
    client.interceptors.response.use(
      (r) => { const ms = Date.now() - ((r.config as { __t?: number }).__t ?? Date.now()); if (ms > 1500) note('SLOW', `${r.config.method} ${r.config.url} ${ms}ms`); return r; },
      (e) => { note('FAILED', `${e?.config?.method} ${e?.config?.url} ${e?.code} ${e?.response?.status ?? ''} ${Date.now() - (e?.config?.__t ?? Date.now())}ms`); return Promise.reject(e); },
    );
    const calendars = await defaultApiDeps(null).calendars();
    const cal = calendars.find((c) => c.name === 'Ordinace 1')!;
    CAL = cal.id;
    SVC = cal.clinicServiceId as string;
    const acts = await fetchBlockableActivities();
    const act = acts.find((a) => a.clinicServiceId === SVC && a.durationMinutes === 40)!;
    ACT = act.id;
    ACT_NAME = act.name;
    created.club = await clubsApi.create({
      name: `ZZ PL-F Testklub ${Date.now()}`,
      ico: String(90000000 + Math.floor(Math.random() * 9999999)),
      address: 'Testovací 1',
      city: 'Slaný',
      postalCode: '274 01',
      contactPerson: 'Test Kontakt',
      contactEmail: 'test@example.test',
      contactPhone: '+420 111 222 333',
      paymentTermsDays: 14,
      discountPercent: null,
      isActive: true,
      management: [{ fullName: 'Karel Předseda', role: 'předseda', phone: '777 000 111', email: 'predseda@example.test', source: 'manual' }],
    });
  }, 60_000);

  afterEach((ctx) => cost(ctx.task.name.slice(0, 40)));

  afterAll(async () => {
    for (const id of [...created.orders].reverse()) await clubOrdersApi.cancel(id, true).catch((e) => note('cleanup order', String(e)));
    for (const a of created.appointments) await appointmentsApi.cancel(a.calendarId, a.id, 'ZZ PL-F test cleanup').catch(() => undefined);
    /* `DELETE /api/clubs/{id}` deactivates: the record and its (cancelled) orders stay. */
    if (created.club) await clubsApi.deactivate(created.club.id).catch((e) => note('cleanup club', String(e)));
  }, 120_000);

  it('reads: catalogue, club header, day marks, budget, standard board', async () => {
    const std = source(null);
    const cat = await std.getCatalogue();
    note('categories', cat.categories.map((c) => `${c.name} ${c.slotMinutes}min ${c.priceCzk}Kč ${c.color}`));
    note('window', cat.window);
    note('releaseDaysBefore', { days: cat.releaseDaysBefore, never: cat.releaseNever ?? false });
    note('capabilities', cat.capabilities);
    expect(cat.categories.length).toBeGreaterThan(5);
    expect(cat.categories.every((c) => /^#[0-9a-fA-F]{6}$/.test(c.color))).toBe(true);
    expect(cat.capabilities).toMatchObject({ canBook: true, canEditBookings: true, mode: 'standard' });

    const marks = await std.listDayMarks({ from: '2026-11-09', to: '2026-11-15' });
    note('dayMarks', marks.map((m) => `${m.date} ${m.closed ? `closed(${m.label})` : `${m.hours?.from}-${m.hours?.to} lunch ${m.lunch?.from}-${m.lunch?.to}`}`));
    expect(marks.find((m) => m.date === '2026-11-14')?.closed).toBe(true);
    expect(marks.find((m) => m.date === '2026-11-10')?.hours).not.toBeNull();
    const budget = await std.getDayBudget();
    note('dayBudget', budget.defaultMinutes);
    expect(budget.defaultMinutes).toBeGreaterThan(0);

    const week = await source(null, { calendarIds: [CAL] }).listSessions({ from: '2026-11-09', to: '2026-11-15' });
    note('board terms 9-15 Nov (Ordinace 1)', week.map((s) => `${s.date} ${s.start}-${s.end} ${s.origin}${s.foreign ? '/foreign' : ''} ${s.booked}/${s.capacity} ${s.clubName ?? ''}`));
    expect(week.some((s) => s.clubBlockId)).toBe(true);
  }, 60_000);

  it('club header of the existing FK Slaný order: the real values', async () => {
    const orders = await clubOrdersApi.list({});
    const fk = orders.find((o) => o.id === '01a107ee-5323-722d-90d9-446be6be7e7d');
    expect(fk).toBeDefined();
    const s = source(editSessionFor(fk!, await fetchBlockableActivities(), TODAY));
    const profile = await s.getClubProfile();
    note('FK Slaný header', profile);
    const order = await s.getOrder();
    note('FK Slaný order', { code: order.code, status: order.status, demands: order.demands, seats: order.totalSeats, registered: order.registered, ranges: order.requestedRanges, link: order.linkUrl });
    const terms = await s.listOrderSessions();
    note('FK Slaný terms', terms.map((t) => `${t.date} ${t.start}-${t.end} cap ${t.capacity} booked ${t.booked}`));
    expect(profile.clubName).toBe('FK Slaný');
    expect(terms.length).toBeGreaterThan(0);
    expect(terms.every((t) => t.start !== '00:00')).toBe(true);
  }, 60_000);

  it('club header: the test club as the header reads it, and an edit through saveClubProfile', async () => {
    const s = source(newSessionOf(1));
    const before = await s.getClubProfile();
    note('test club header', before);
    expect(before).toMatchObject({ leaderName: 'Karel Předseda', leaderEmail: 'predseda@example.test', leaderPhone: '777 000 111', contactName: 'Test Kontakt', address: 'Testovací 1, 274 01 Slaný' });
    const saved = await s.saveClubProfile({ contactPhone: '+420 999 888 777', leaderPhone: '777 000 222', leaderEmail: '' });
    expect(saved).toMatchObject({ contactPhone: '+420 999 888 777', leaderPhone: '777 000 222', leaderEmail: '', leaderName: 'Karel Předseda' });
    const real = await clubsApi.getById(created.club!.id);
    note('club after edit', { contactPhone: real.contactPhone, city: real.city, postalCode: real.postalCode, management: real.management });
    expect(real.contactPhone).toBe('+420 999 888 777');
    expect(real.city).toBe('Slaný'); // untouched fields stay
    expect(real.management).toHaveLength(1);
    expect(real.management![0]).toMatchObject({ fullName: 'Karel Předseda', role: 'předseda', phone: '777 000 222', email: null });
    expect(real.management![0]!.id).toBe(created.club!.management![0]!.id); // the member keeps its id through the replace
  }, 60_000);

  let orderId = '';

  it('create: a staff order through finishPlan - one POST, the window the server really holds', async () => {
    const s = source(newSessionOf(3));
    const made = await s.createInterval({ date: '2026-12-16', categoryId: ACT, start: '09:00', quantity: 3 });
    expect(made.session).toMatchObject({ start: '09:00', end: '11:00', capacity: 3 });
    const result = await s.finishPlan();
    note('finishPlan(create)', result);
    orderId = result.orderId as string;
    created.orders.push(orderId);
    expect(result).toMatchObject({ ready: true, windows: 1 });
    const real = await clubOrdersApi.get(orderId);
    note('server order', { status: real.status, ranges: rangesOf(real), blocks: real.blocks.map((b) => `${b.fromDate} ${b.dailyFrom}-${b.dailyTo} cal ${b.calendarIds.length}`), seats: real.activitySeats.map((a) => a.seats) });
    expect(real.status).toBe('Confirmed');
    expect(real.activitySeats[0]).toMatchObject({ activityId: ACT, seats: 3 });
    expect(rangesOf(real)).toEqual(['2026-12-16 09:00-11:00']);
    expect(real.blocks[0]!.calendarIds).toEqual([CAL]);
    // the saved order is now the one being edited
    expect((await s.getOrder()).id).toBe(orderId);
    expect(await s.listOrderSessions()).toHaveLength(1);
    // the same club again: the desk is asked, nothing is created silently
    const again = source(newSessionOf(2));
    await again.createInterval({ date: '2026-12-21', categoryId: ACT, start: '09:00', quantity: 2 });
    const refusal = await again.finishPlan().catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(PlannerDuplicateOrderError);
    note('duplicate', (refusal as PlannerDuplicateOrderError).liveOrders);
    expect((await clubOrdersApi.list({ clubId: created.club!.id })).length).toBe(1);
  }, 120_000);

  it('update: changed players, a moved window and a new window - one PUT, verified on the server', async () => {
    const session = await editSessionOf(orderId, (x) => ({ ...x, activities: x.activities.map((a) => ({ ...a, seats: 5 })), editOrder: { ...x.editOrder!, dirty: true } }));
    const s = source(session);
    const [term] = await s.listOrderSessions();
    expect(term).toMatchObject({ date: '2026-12-16', start: '09:00', end: '11:00', capacity: 3, booked: 0 });
    await s.moveInterval({ id: term!.id, date: '2026-12-17', start: '09:00', end: '11:00', expectedVersion: term!.version });
    await s.createInterval({ date: '2026-12-18', categoryId: ACT, start: '09:00', quantity: 2 });
    const result = await s.finishPlan();
    note('finishPlan(update)', result);
    const real = await clubOrdersApi.get(orderId);
    note('server order', { ranges: rangesOf(real), seats: real.activitySeats.map((a) => a.seats) });
    expect(real.activitySeats[0]!.seats).toBe(5);
    expect(rangesOf(real)).toEqual(['2026-12-17 09:00-11:00', '2026-12-18 09:00-10:20']);
    expect(result.ready).toBe(true);
    // an untouched order goes back exactly as it is
    const calm = source(await editSessionOf(orderId));
    await calm.finishPlan();
    expect(rangesOf(await clubOrdersApi.get(orderId))).toEqual(['2026-12-17 09:00-11:00', '2026-12-18 09:00-10:20']);
  }, 120_000);

  it('409: removing a window with a registered athlete asks first; confirmed, the same write cancels the athlete', async () => {
    const real = await clubOrdersApi.get(orderId);
    expect(real.registrationToken).toBeTruthy();
    const claim = await fetch(`${API}/api/public/club/${real.registrationToken}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activityId: ACT, name: 'ZZ PL-F Hráč', phone: '+420 111 000 222', startUtc: '2026-12-17T08:00:00Z' }),
    });
    const claimBody = await claim.text();
    note('claim', `${claim.status} ${claimBody.slice(0, 200)}`);
    expect(claim.status).toBeLessThan(300);

    const s = source(await editSessionOf(orderId));
    const terms = await s.listOrderSessions();
    const withAthlete = terms.find((t) => t.date === '2026-12-17')!;
    note('term with athlete', `${withAthlete.date} ${withAthlete.start}-${withAthlete.end} booked ${withAthlete.booked}`);
    expect(withAthlete.booked).toBe(1);
    await s.deleteInterval(withAthlete.id);
    const failure = (await s.finishPlan().catch((e: unknown) => e)) as PlannerWriteError;
    note('409', { code: failure.code, message: failure.message, athletes: failure.affectedAthletes });
    expect(failure).toBeInstanceOf(PlannerWriteError);
    expect(failure.code).toBe('conflict');
    expect(failure.affectedAthletes.map((a) => a.name)).toContain('ZZ PL-F Hráč');
    // nothing happened to the order yet
    expect(rangesOf(await clubOrdersApi.get(orderId))).toEqual(['2026-12-17 09:00-11:00', '2026-12-18 09:00-10:20']);
    const done = await s.finishPlan({ cancelAffectedAthletes: true });
    note('confirmed', done);
    expect(rangesOf(await clubOrdersApi.get(orderId))).toEqual(['2026-12-18 09:00-10:20']);
    const blocks = await clubBlocksApi.list({ from: '2026-12-17', to: '2026-12-17' }).catch(() => []);
    expect(blocks.filter((b) => b.clubOrderId === orderId && b.status === 'Active')).toHaveLength(0);
  }, 120_000);

  it('standard mode: move a booking with notifyPatient, version-checked, and move it back', async () => {
    const booked = await appointmentsApi.createUnregistered({ calendarId: CAL, activityId: ACT, startUtc: '2026-12-22T08:00:00Z', name: 'ZZ PL-F Walkin', phone: '+420 111 000 111' });
    created.appointments.push({ calendarId: CAL, id: booked.id });
    const std = source(null, { calendarIds: [CAL] });
    const week = { from: '2026-12-21', to: '2026-12-27' };
    const term = (await std.listSessions(week)).find((t) => t.appointmentIds?.includes(booked.id))!;
    note('standard term', `${term.date} ${term.start}-${term.end} ${term.booked}/${term.capacity} v=${term.version?.slice(0, 40)}`);
    expect(term).toMatchObject({ start: '09:00', end: '09:40', booked: 1 });

    const moved = await std.moveInterval({ id: term.id, date: '2026-12-22', start: '10:00', end: '10:40', expectedVersion: term.version, notifyPatient: true });
    note('moved', { start: moved.session.start, notified: moved.notified });
    expect((await appointmentsApi.get(CAL, booked.id)).startUtc).toBe('2026-12-22T09:00:00Z');
    expect(moved.notified.individuals).toBe(0); // a walk-in has nobody to tell

    // the desk's version is old now: refused, nothing written
    const stale = await std.moveInterval({ id: term.id, date: '2026-12-22', start: '11:00', end: '11:40', expectedVersion: term.version }).catch((e: unknown) => e);
    expect(stale).toMatchObject({ code: 'stale' });
    expect((await appointmentsApi.get(CAL, booked.id)).startUtc).toBe('2026-12-22T09:00:00Z');

    // the server's own 412 (a wrong If-Match) reads as stale too
    const wrong = await appointmentsApi.reschedule(CAL, booked.id, '2026-12-22T10:00:00Z', undefined, { notifyPatient: false, ifMatch: 'pg-xmin-v1.AAAAAA' }).catch((e: unknown) => e);
    expect(toWriteError(wrong)).toMatchObject({ code: 'stale' });

    // and back (undo restores the booking where it was)
    await std.undo(moved.undoToken as string);
    expect((await appointmentsApi.get(CAL, booked.id)).startUtc).toBe('2026-12-22T08:00:00Z');
    const again = (await std.listSessions(week)).find((t) => t.appointmentIds?.includes(booked.id))!;
    const back = await std.moveInterval({ id: again.id, date: '2026-12-22', start: '09:30', end: '10:10', expectedVersion: again.version, notifyPatient: false });
    expect((await appointmentsApi.get(CAL, booked.id)).startUtc).toBe('2026-12-22T08:30:00Z');
    await std.undo(back.undoToken as string);
    expect((await appointmentsApi.get(CAL, booked.id)).startUtc).toBe('2026-12-22T08:00:00Z');
  }, 120_000);
});
