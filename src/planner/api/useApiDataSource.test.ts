import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { orderKey } from '../club/clubStageReads';
import { fakeDeps, orderView } from './testSupport';
import { differsForStage, parseSeats, startFromShared } from './useApiDataSource';

describe('parseSeats', () => {
  it('reads activityId:seats pairs and drops anything malformed', () => {
    expect(parseSeats('a:3,b:10')).toEqual([{ activityId: 'a', seats: 3 }, { activityId: 'b', seats: 10 }]);
    expect(parseSeats('a:0,b:x,:4,c:2.5,d:7')).toEqual([{ activityId: 'd', seats: 7 }]);
    expect(parseSeats(null)).toEqual([]);
    expect(parseSeats('')).toEqual([]);
  });
});

/*
 * The first read of the order a source plans does not wait for `club-orders/{id}` when its answer is already here; the
 * single read still runs (once) behind it, and a disagreement rebuilds the source.
 */
describe('startFromShared - the first read of the order', () => {
  const ROW = orderView({ id: 'o-1', history: [] });
  const SINGLE = { ...ROW, history: [{ atUtc: '2026-10-01T10:00:00Z', user: 'Anna', text: 'Potvrzeno', visibleToClub: true }] };

  function setup(single: typeof ROW = SINGLE) {
    const client = new QueryClient();
    const fake = fakeDeps();
    const order = vi.fn((id: string) => client.fetchQuery({ queryKey: orderKey(id), queryFn: async () => single, staleTime: 0 }));
    const onDiffers = vi.fn();
    const deps = startFromShared({ ...fake, order }, client, 'o-1', onDiffers);
    return { client, order, onDiffers, deps };
  }

  it('takes the row of a current list at once and runs the single read behind it; history alone is no difference', async () => {
    const { client, order, onDiffers, deps } = setup();
    client.setQueryData(['club-orders', 'club-1', '', ''], [ROW]);
    await expect(deps.order('o-1')).resolves.toBe(ROW);
    expect(order).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(client.getQueryData(orderKey('o-1'))).toEqual(SINGLE));
    expect(onDiffers).not.toHaveBeenCalled();
  });

  it('rebuilds when the single read says something the stage draws differently', async () => {
    const { client, onDiffers, deps } = setup({ ...SINGLE, status: 'Cancelled' });
    client.setQueryData(['club-orders', 'club-1', '', ''], [ROW]);
    await deps.order('o-1');
    await vi.waitFor(() => expect(onDiffers).toHaveBeenCalledTimes(1));
  });

  it('takes a current answer of the single read itself, asking nothing', async () => {
    const { client, order, deps } = setup();
    client.setQueryData(orderKey('o-1'), SINGLE);
    await expect(deps.order('o-1')).resolves.toBe(SINGLE);
    expect(order).not.toHaveBeenCalled();
  });

  it('falls back to the single read when nothing current is here, and every later read is the single read', async () => {
    const { client, order, deps } = setup();
    client.setQueryData(['club-orders', 'club-1', '', ''], [ROW], { updatedAt: Date.now() - 60_000 });
    await expect(deps.order('o-1')).resolves.toEqual(SINGLE);
    expect(order).toHaveBeenCalledTimes(1);
    await deps.order('o-1');
    expect(order).toHaveBeenCalledTimes(2);
  });

  it('compares everything but the history', () => {
    expect(differsForStage(ROW, SINGLE)).toBe(false);
    expect(differsForStage(ROW, { ...SINGLE, blocks: [] })).toBe(true);
  });
});
