/*
 * The three rules every read goes through: identical concurrent reads share one request, a 429 is waited out and
 * never turned into a storm, and a write tells whoever keeps a cache.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

vi.mock('../services/socketService', () => ({ socketService: { stop: vi.fn() } }));

const { client, resetClientStateForTests } = await import('./client');
const { resetConnectionForTests } = await import('./connection');
const { onWriteSucceeded, resetRequestPolicyForTests, retryDelayMs, MAX_WAIT_MS, RATE_LIMIT_RETRIES, SHARE_GRACE_MS } =
  await import('./requestPolicy');

const originalAdapter = client.defaults.adapter;

function ok(data: unknown, config: InternalAxiosRequestConfig) {
  return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} };
}

function tooMany(config: InternalAxiosRequestConfig, retryAfter?: string) {
  const headers = new AxiosHeaders(retryAfter === undefined ? {} : { 'retry-after': retryAfter });
  const response = { data: {}, status: 429, statusText: 'Too Many Requests', headers, config, request: {} };
  return new AxiosError('rate', 'ERR_BAD_REQUEST', config, {}, response);
}

/** An adapter whose answers are released by hand, so two callers can overlap. */
function gate() {
  const calls: string[] = [];
  const waiting: Array<() => void> = [];
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve) => {
      calls.push(`${config.method} ${config.url}`);
      waiting.push(() => resolve(ok({ n: calls.length, list: [1, 2, 3] }, config)));
    });
  return { adapter, calls, release: () => waiting.splice(0).forEach((fn) => fn()) };
}

beforeEach(() => {
  resetClientStateForTests();
  resetConnectionForTests();
  resetRequestPolicyForTests();
  localStorage.setItem('token', 't');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
});

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('identical concurrent reads', () => {
  it('send one request and give every caller its own copy of the answer', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;

    const a = client.get('/api/activities');
    const b = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(1));
    g.release();
    const [first, second] = await Promise.all([a, b]);

    expect(g.calls).toEqual(['get /api/activities']);
    expect(first.data).toEqual({ n: 1, list: [1, 2, 3] });
    expect(second.data).toEqual(first.data);
    expect(second.data).not.toBe(first.data);
    (first.data as { list: number[] }).list.push(4);
    expect((second.data as { list: number[] }).list).toEqual([1, 2, 3]);
  });

  it('are different reads when the address or the parameters differ', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;

    const reads = [
      client.get('/api/day', { params: { from: '2026-10-01' } }),
      client.get('/api/day', { params: { from: '2026-10-02' } }),
      client.get('/api/calendars'),
    ];
    await vi.waitFor(() => expect(g.calls).toHaveLength(3));
    g.release();
    await Promise.all(reads);
  });

  it('share an answer that arrived a moment ago, but not an older one', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;

    const first = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(1));
    g.release();
    await first;

    const justAfter = await client.get('/api/activities');
    expect(g.calls).toHaveLength(1);
    expect(justAfter.data).toEqual({ n: 1, list: [1, 2, 3] });

    await new Promise((resolve) => setTimeout(resolve, SHARE_GRACE_MS + 100));
    const later = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(2));
    g.release();
    await later;
  });

  it('never share a polled feed once its answer is in', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;

    const first = client.get('/api/notifications');
    await vi.waitFor(() => expect(g.calls).toHaveLength(1));
    g.release();
    await first;

    const second = client.get('/api/notifications');
    await vi.waitFor(() => expect(g.calls).toHaveLength(2));
    g.release();
    await second;
  });

  it('do not share an answer across a write', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;

    const first = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(1));
    g.release();
    await first;

    const write = client.post('/api/activities', {});
    await vi.waitFor(() => expect(g.calls).toHaveLength(2));
    g.release();
    await write;

    const second = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(3));
    g.release();
    await second;
  });

  it('do not join a read that began before a write', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;

    const before = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(1));
    const write = client.post('/api/activities', { name: 'x' });
    await vi.waitFor(() => expect(g.calls).toHaveLength(2));
    const after = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(3));

    g.release();
    await Promise.all([before, write, after]);
  });

  it('are never shared when the caller can cancel them', async () => {
    const g = gate();
    client.defaults.adapter = g.adapter;
    const controller = new AbortController();

    const a = client.get('/api/activities', { signal: controller.signal });
    const b = client.get('/api/activities');
    await vi.waitFor(() => expect(g.calls).toHaveLength(2));
    g.release();
    await Promise.all([a, b]);
  });

  it('pass a failure to every caller', async () => {
    let calls = 0;
    client.defaults.adapter = async (config) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      throw new AxiosError('boom', 'ERR_BAD_RESPONSE', config, {}, { data: {}, status: 500, statusText: '', headers: {}, config });
    };

    const results = await Promise.allSettled([client.get('/api/x'), client.get('/api/x')]);

    expect(calls).toBe(1);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
  });
});

describe('a 429 on a read', () => {
  it('is waited out and the read is tried again', async () => {
    let calls = 0;
    client.defaults.adapter = async (config) => {
      calls += 1;
      if (calls === 1) throw tooMany(config, '0');
      return ok({ fine: true }, config);
    };

    const res = await client.get('/api/v1/club-orders');

    expect(res.data).toEqual({ fine: true });
    expect(calls).toBe(2);
  });

  it('is tried again at most twice and then handed to the screen', async () => {
    let calls = 0;
    client.defaults.adapter = async (config) => {
      calls += 1;
      throw tooMany(config, '0');
    };

    await expect(client.get('/api/v1/club-orders')).rejects.toMatchObject({ response: { status: 429 } });
    expect(calls).toBe(1 + RATE_LIMIT_RETRIES);
  });

  it('is not waited for when the server wants longer than a screen can stand', async () => {
    let calls = 0;
    client.defaults.adapter = async (config) => {
      calls += 1;
      throw tooMany(config, String(MAX_WAIT_MS / 1000 + 5));
    };

    await expect(client.get('/api/v1/club-orders')).rejects.toMatchObject({ response: { status: 429 } });
    expect(calls).toBe(1);
  });

  it('holds back the other reads for the pause the server asked for', async () => {
    let calls = 0;
    const startedAt: number[] = [];
    client.defaults.adapter = async (config) => {
      calls += 1;
      startedAt.push(Date.now());
      if (config.url === '/api/a' && calls === 1) throw tooMany(config, '1');
      return ok({}, config);
    };

    const a = client.get('/api/a');
    await vi.waitFor(() => expect(calls).toBe(1));
    const t0 = startedAt[0];
    await client.get('/api/b');
    await a;

    expect(startedAt[1] - t0).toBeGreaterThanOrEqual(950);
  });

  it('is never retried on a write', async () => {
    let calls = 0;
    client.defaults.adapter = async (config) => {
      calls += 1;
      throw tooMany(config, '0');
    };

    await expect(client.post('/api/calendars/1/appointments', {})).rejects.toMatchObject({ response: { status: 429 } });
    expect(calls).toBe(1);
  });
});

describe('retryDelayMs', () => {
  it('reads seconds, a date, or falls back to a growing pause', () => {
    expect(retryDelayMs('3', 0)).toBe(3_000);
    expect(retryDelayMs('0', 0)).toBe(0);
    expect(retryDelayMs(new Date(10_000 + 4_000).toUTCString(), 0, 10_000)).toBe(4_000);
    expect(retryDelayMs(undefined, 0)).toBe(1_000);
    expect(retryDelayMs(undefined, 1)).toBe(2_000);
    expect(retryDelayMs('nonsense', 1)).toBe(2_000);
  });
});

describe('onWriteSucceeded', () => {
  it('hears about accepted writes, not reads and not refused writes', async () => {
    const heard: string[] = [];
    onWriteSucceeded((w) => heard.push(`${w.method} ${w.url}`));

    client.defaults.adapter = async (config) => ok({}, config);
    await client.get('/api/calendars');
    await client.post('/api/calendars', {});
    await client.put('/api/calendars/1', {});

    client.defaults.adapter = async (config) => {
      throw new AxiosError('no', 'ERR_BAD_REQUEST', config, {}, { data: {}, status: 400, statusText: '', headers: {}, config });
    };
    await expect(client.delete('/api/calendars/1')).rejects.toBeInstanceOf(AxiosError);

    expect(heard).toEqual(['post /api/calendars', 'put /api/calendars/1']);
  });
});
