/*
 * Stage 6, R4 / R17: the override of a `worker.busy` refusal on a club order update is the query parameter `overrideReason`
 * (contract stage2-contract.md, "Delivered"), the refusal's `details` survive on the error, and `workerBusyOf` reads it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { put } = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn(), put }, client: { get: vi.fn(), post: vi.fn(), put } }));

const { clubOrdersApi, ClubOrderError } = await import('./clubOrders');
const { workerBusyOf, isOverrideForbidden } = await import('./workerBusy');

beforeEach(() => { put.mockReset(); });

describe('clubOrdersApi.update override', () => {
  it('sends no params at all without an override or a cancel of athletes', async () => {
    put.mockResolvedValue({ status: 200, data: { id: 'o1' } });
    await clubOrdersApi.update('o1', { ranges: [], calendarIds: [] });
    expect(put).toHaveBeenCalledWith('/api/v1/club-orders/o1', { ranges: [], calendarIds: [] }, { params: undefined });
  });

  it('sends overrideReason (and cancelAffectedAthletes when asked) as query parameters, never in the body', async () => {
    put.mockResolvedValue({ status: 200, data: { id: 'o1' } });
    await clubOrdersApi.update('o1', { ranges: [], calendarIds: [] }, true, 'dohodnuto');
    expect(put).toHaveBeenCalledWith('/api/v1/club-orders/o1', { ranges: [], calendarIds: [] }, { params: { cancelAffectedAthletes: true, overrideReason: 'dohodnuto' } });
  });

  it('keeps the details of a worker.busy 409 so the clash can be named, and workerBusyOf reads a club order error', async () => {
    put.mockRejectedValue({ response: { status: 409, data: { code: 'worker.busy', message: 'Pracovník je zaneprázdněn.', details: { conflictKind: 'clubBlock', activityName: 'Spiroergometrie', overridable: true, conflictCount: 2 } } } });
    const e = (await clubOrdersApi.update('o1', { ranges: [], calendarIds: [] }).catch((x: unknown) => x)) as InstanceType<typeof ClubOrderError>;
    expect(e).toBeInstanceOf(ClubOrderError);
    const busy = workerBusyOf(e);
    expect(busy?.overridable).toBe(true);
    expect(busy?.details).toMatchObject({ conflictKind: 'clubBlock', activityName: 'Spiroergometrie', conflictCount: 2 });
  });

  it('a 403 override_forbidden is recognised; an unrelated order error is neither', async () => {
    put.mockRejectedValue({ response: { status: 403, data: { code: 'worker.busy.override_forbidden', message: 'x' } } });
    const forbidden = await clubOrdersApi.update('o1', { ranges: [], calendarIds: [] }, false, 'r').catch((x: unknown) => x);
    expect(isOverrideForbidden(forbidden)).toBe(true);
    expect(workerBusyOf(forbidden)).toBeNull();
    put.mockRejectedValue({ response: { status: 409, data: { code: 'club_order.changed', message: 'y' } } });
    const other = await clubOrdersApi.update('o1', { ranges: [], calendarIds: [] }).catch((x: unknown) => x);
    expect(workerBusyOf(other)).toBeNull();
    expect(isOverrideForbidden(other)).toBe(false);
  });
});
