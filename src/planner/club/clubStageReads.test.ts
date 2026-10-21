/*
 * The club screen's stage reads, started early: they must be EXACTLY what the stage asks when it draws (else they are
 * either wasted or the stage still waits). The real `ApiDataSource` is run against recording deps and its reads are
 * compared with the plan; the selection rule is the screen's; the inquiries share the club list's answer.
 */
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { ClubOrderView } from '../../api/clubOrders';
import { CAL_A, CAL_B, calendar, clubBlock, editSession, fakeDeps, fakeState, orderView } from '../api/testSupport';
import { ApiDataSource } from '../data/ApiDataSource';
import { createInitialState } from '../state/plannerState';
import { selectVisibleRange } from '../state/selectors';
import {
  ALL_ORDERS_KEY,
  INQUIRIES_KEY,
  LIST_SHARE_MAX_AGE_MS,
  chunkRange,
  clubSelection,
  orderFromLists,
  orderKey,
  orderReadState,
  prefetchClubStage,
  shareAllOrders,
  stageReads,
  type StageRead,
  type StageStart,
} from './clubStageReads';

const TODAY = '2026-11-02';
const CAL_C = 'cal-c';
const CAL_OFF = 'cal-off';
/* A and B belong to the order's služba, C to another, the last one is switched off. */
const CALENDARS = [calendar(CAL_A), calendar(CAL_B), calendar(CAL_C, { clinicServiceId: 'svc-other' }), calendar(CAL_OFF, { isActive: false })];

/** Every read the data source makes when the stage draws (what `usePlannerModel` asks for). */
async function readsOfTheStage(options: ConstructorParameters<typeof ApiDataSource>[0], openOn: string): Promise<StageRead[]> {
  const deps = fakeDeps(fakeState({ calendars: CALENDARS }));
  const source = new ApiDataSource({ ...options, deps, today: TODAY });
  const range = selectVisibleRange(createInitialState({ today: TODAY, selectedDate: openOn }));
  await Promise.all([
    source.getCatalogue(),
    source.getOrder(),
    source.getClubProfile(),
    source.getDayBudget(),
    source.listSessions(range),
    source.listOrderSessions(),
    source.listDayMarks(range),
  ]);
  return [
    ...deps.previews.mock.calls.map(([ids, from, to]) => ({ kind: 'previews', ids, from, to }) as StageRead),
    ...deps.range.mock.calls.map(([from, to, ids]) => ({ kind: 'range', ids, from, to }) as StageRead),
    ...deps.blocks.mock.calls.map(([id, from, to]) => ({ kind: 'blocks', id, from, to }) as StageRead),
    ...deps.clubBlocks.mock.calls.map(([from, to]) => ({ kind: 'clubBlocks', from, to }) as StageRead),
    ...deps.holidays.mock.calls.map(([year]) => ({ kind: 'holidays', year }) as StageRead),
  ];
}

const keyOf = (r: StageRead) => JSON.stringify(r);
const asSet = (reads: StageRead[]) => new Set(reads.map(keyOf));
/** The board's own reads (the real calendar): the shown week of every active calendar. */
const boardReads = (openOn: string): StageRead[] => {
  const week = createInitialState({ today: TODAY, selectedDate: openOn }).weekStart;
  const to = addDays(week, 6);
  const all = [CAL_A, CAL_B, CAL_C];
  return [{ kind: 'range', ids: all, from: week, to }, { kind: 'previews', ids: all, from: week, to }];
};
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('stageReads - the plan is what the stage reads', () => {
  it('an edited order: the preview of its days, the shown calendars (its own + its služba), the range, the look-ahead, the board week', async () => {
    const order = orderView();
    const openOn = '2026-11-23';
    const start: StageStart = { today: TODAY, openOn, session: { serviceId: order.serviceId ?? '', order } };
    const plan = stageReads(start, CALENDARS);
    const stage = await readsOfTheStage({ session: editSession(order) }, openOn);

    expect(asSet(stage)).toEqual(asSet(plan.filter((r) => !asSet(boardReads(openOn)).has(keyOf(r)))));
    expect(plan.map(keyOf)).toEqual(expect.arrayContaining(boardReads(openOn).map(keyOf)));
    /* nothing of the switched-off calendar, nothing of the other služba's calendar outside the board */
    expect(plan.filter((r) => r.kind === 'blocks').map((r) => (r as { id: string }).id)).toEqual([CAL_A, CAL_B]);
    expect(plan[0]).toEqual({ kind: 'previews', ids: [CAL_A], from: '2026-11-23', to: '2026-11-23' });
  });

  it("a club with nothing to plan (the club's context): every active calendar, no order read", async () => {
    const openOn = '2026-12-14';
    const plan = stageReads({ today: TODAY, openOn, session: null }, CALENDARS);
    const stage = await readsOfTheStage({ clubContext: { clubId: 'club-1', clubName: 'FK Slaný' } }, openOn);
    expect(asSet(stage)).toEqual(asSet(plan.filter((r) => !asSet(boardReads(openOn)).has(keyOf(r)))));
    expect(plan.filter((r) => r.kind === 'blocks').map((r) => (r as { id: string }).id)).toEqual([CAL_A, CAL_B, CAL_C]);
  });

  it('a range longer than the data source reads at once is split exactly as it splits it', () => {
    expect(chunkRange({ from: '2026-01-01', to: '2026-03-31' })).toEqual([
      { from: '2026-01-01', to: '2026-03-03' },
      { from: '2026-03-04', to: '2026-03-31' },
    ]);
  });
});

describe('clubSelection - the screen\'s rule', () => {
  const ahead = orderView({ id: 'o-ahead', groupId: 'o-ahead', blocks: [clubBlock('w-1', { fromDate: '2026-11-23', toDate: '2026-11-23' })] });
  const later = orderView({ id: 'o-later', groupId: 'o-later', blocks: [clubBlock('w-2', { fromDate: '2027-01-11', toDate: '2027-01-11' })] });

  it('opens the group with the nearest window ahead, on that window; its root is what the stage loads', () => {
    const s = clubSelection([later, ahead], [], TODAY, { orderId: null, blockId: null });
    expect(s.selected?.id).toBe('o-ahead');
    expect(s.openOn).toBe('2026-11-23');
    expect(s.start).toEqual({ today: TODAY, openOn: '2026-11-23', session: { serviceId: ahead.serviceId, order: ahead } });
  });

  it('`?order=` and a named window pick their group; a router session replaces the group\'s own', () => {
    expect(clubSelection([later, ahead], [], TODAY, { orderId: 'o-later', blockId: null }).openOn).toBe('2027-01-11');
    expect(clubSelection([later, ahead], [], TODAY, { orderId: null, blockId: 'w-2' }).selected?.id).toBe('o-later');
    const routed = editSession(later, { serviceId: 'svc-x' });
    const s = clubSelection([later, ahead], [], TODAY, { orderId: null, blockId: null, session: routed });
    expect(s.start).toEqual({ today: TODAY, openOn: '2026-11-23', session: { serviceId: 'svc-x', order: later } });
  });

  it('a group the stage cannot edit gives the club context only', () => {
    const invited = orderView({ id: 'o-inv', groupId: 'o-inv', status: 'Invited', blocks: [] });
    expect(clubSelection([invited], [], TODAY, { orderId: null, blockId: null }).start.session).toBeNull();
  });
});

describe('sharing what is already here', () => {
  it('the inquiries take the club list\'s unfiltered answer, with its age; an old one is not shared', () => {
    const client = new QueryClient();
    const all = [orderView()];
    client.setQueryData(ALL_ORDERS_KEY, all, { updatedAt: Date.now() - 1000 });
    expect(shareAllOrders(client)).toBe(true);
    expect(client.getQueryData(INQUIRIES_KEY)).toBe(all);
    expect(client.getQueryState(INQUIRIES_KEY)?.dataUpdatedAt).toBe(client.getQueryState(ALL_ORDERS_KEY)?.dataUpdatedAt);

    const old = new QueryClient();
    old.setQueryData(ALL_ORDERS_KEY, all, { updatedAt: Date.now() - LIST_SHARE_MAX_AGE_MS - 1 });
    expect(shareAllOrders(old)).toBe(false);
    expect(old.getQueryData(INQUIRIES_KEY)).toBeUndefined();
  });

  it('finds the order in a current list of orders, never in one a write marked stale', async () => {
    const client = new QueryClient();
    const row = orderView({ id: 'o-1' });
    client.setQueryData(['club-orders', 'club-1', '', ''], [row]);
    expect(orderFromLists(client, 'o-1')).toBe(row);
    expect(orderFromLists(client, 'o-2')).toBeUndefined();
    await client.invalidateQueries({ queryKey: ['club-orders'], refetchType: 'none' });
    expect(orderFromLists(client, 'o-1')).toBeUndefined();
  });

  it('says whether the order\'s own read is current, running or not there', async () => {
    const client = new QueryClient();
    expect(orderReadState(client, 'o-1')).toBe('none');
    let done: (v: ClubOrderView) => void = () => undefined;
    void client.fetchQuery({ queryKey: orderKey('o-1'), queryFn: () => new Promise<ClubOrderView>((r) => (done = r)) });
    expect(orderReadState(client, 'o-1')).toBe('running');
    done(orderView({ id: 'o-1' }));
    await vi.waitFor(() => expect(orderReadState(client, 'o-1')).toBe('current'));
    expect(orderReadState(client, 'o-1', Date.now() + 60_000)).toBe('none');
  });
});

describe('prefetchClubStage', () => {
  it('starts the order\'s own read once and every planned read; a second start asks the order nothing new', async () => {
    const client = new QueryClient();
    client.setQueryData(ALL_ORDERS_KEY, []);
    const fake = fakeDeps(fakeState({ calendars: CALENDARS }));
    /* the order read through the cache, as `defaultApiDeps` does it */
    const deps = { ...fake, order: vi.fn((id: string) => client.fetchQuery({ queryKey: orderKey(id), queryFn: () => fake.order(id), staleTime: 0 })) };
    const order = orderView();
    const start: StageStart = { today: TODAY, openOn: '2026-11-23', session: { serviceId: order.serviceId ?? '', order } };
    await prefetchClubStage(client, start, deps);
    await prefetchClubStage(client, start, deps);
    expect(deps.order).toHaveBeenCalledTimes(1);
    expect(fake.previews).toHaveBeenCalled();
    expect(fake.range).toHaveBeenCalledWith('2026-10-26', '2026-12-06', [CAL_A, CAL_B]);
    expect(client.getQueryData(INQUIRIES_KEY)).toEqual([]);
  });

  it('drops a failure: the stage asks again when it draws', async () => {
    const client = new QueryClient();
    client.setQueryData(ALL_ORDERS_KEY, []);
    const deps = fakeDeps(fakeState({ calendars: CALENDARS }));
    deps.range.mockRejectedValue(new Error('offline'));
    await expect(prefetchClubStage(client, { today: TODAY, openOn: TODAY, session: null }, deps)).resolves.toBeUndefined();
  });
});
