/*
 * Permanent delete: `?permanent=true` is sent, and a 409 `*.in_use` keeps its
 * message and its usage counts (zero or missing counts become 0).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

/* A plain fake, not vi.fn: vitest tracks a spy's rejected promises and reports them as unhandled. */
const calls: unknown[][] = [];
let respond: () => Promise<unknown> = async () => ({ data: {} });
const del = (...args: unknown[]) => { calls.push(args); return respond(); };
vi.mock('./client', () => ({ default: { delete: del }, client: { delete: del } }));

const { clinicServicesApi } = await import('./clinicServices');
const { activitiesApi } = await import('./activities');
const { isInUse } = await import('./deleteInUse');

const refusal = (code: string, usage: unknown) => {
  const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
  error.response = {
    status: 409, statusText: 'Conflict', headers: {}, config: {} as never,
    data: { code, message: 'Nejde to smazat.', usage },
  };
  return error;
};

beforeEach(() => { calls.length = 0; respond = async () => ({ data: {} }); });

describe('permanent delete', () => {
  it('asks for permanent=true on a služba and on a činnost', async () => {
    await clinicServicesApi.removePermanently('s1');
    await activitiesApi.removePermanently('a1');
    expect(calls[0]).toEqual(['/api/clinic-services/s1', { params: { permanent: true } }]);
    expect(calls[1]).toEqual(['/api/activities/a1', { params: { permanent: true } }]);
  });

  it('plain remove still archives (no permanent flag)', async () => {
    await clinicServicesApi.remove('s1');
    expect(calls[0]).toEqual(['/api/clinic-services/s1']);
  });

  it('turns 409 service.in_use into an error that carries the usage', async () => {
    respond = () => Promise.reject(refusal('service.in_use', { appointments: 12, calendars: 2 }));
    let caught: unknown = null;
    try {
      await clinicServicesApi.removePermanently('s1');
    } catch (e) {
      caught = e;
    }
    expect(isInUse(caught)).toBe(true);
    expect((caught as { serverMessage?: string }).serverMessage).toBe('Nejde to smazat.');
    expect((caught as { usage?: unknown }).usage).toEqual({ appointments: 12, clubOrders: 0, clubBlocks: 0, priceItems: 0, calendars: 2, activities: 0 });
  });

  it('does the same for activity.in_use, and other 409s are not in-use', async () => {
    respond = () => Promise.reject(refusal('activity.in_use', undefined));
    expect(isInUse(await activitiesApi.removePermanently('a1').catch((e: unknown) => e))).toBe(true);
    respond = () => Promise.reject(refusal('something.else', {}));
    expect(isInUse(await activitiesApi.removePermanently('a1').catch((e: unknown) => e))).toBe(false);
  });
});
