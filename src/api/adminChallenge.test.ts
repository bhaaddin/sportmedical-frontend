/*
 * The two things the server can ask of an administrator in the middle of a request (src/auth/adminChallenge.ts), driven
 * through the real client with a fake adapter:
 *   403 reconfirm_required   the window asks, the SAME request is sent once more
 *   403 two_factor_required  the Administrace shows the 2FA notice, the request is not retried
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

vi.mock('../services/socketService', () => ({ socketService: { stop: vi.fn() } }));

const { client, resetClientStateForTests } = await import('./client');
const challenge = await import('../auth/adminChallenge');

const originalAdapter = client.defaults.adapter;

/** Answers the given codes in turn, then 200. Counts the calls. */
function script(...codes: (string | 200)[]) {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const next = codes[calls.length - 1] ?? 200;
    const response = { data: next === 200 ? { ok: true } : { code: next }, status: next === 200 ? 200 : 403, statusText: '', headers: {}, config, request: {} };
    if (next === 200) return response;
    throw new AxiosError('refused', 'ERR_BAD_RESPONSE', config, {}, response);
  };
  client.defaults.adapter = adapter;
  return calls;
}

beforeEach(() => {
  resetClientStateForTests();
  challenge.resetAdminChallengeForTests();
  localStorage.setItem('token', 't');
});
afterEach(() => {
  client.defaults.adapter = originalAdapter;
  localStorage.clear();
});

describe('problemCodeOf', () => {
  it('reads the code wherever the server put it', () => {
    expect(challenge.problemCodeOf({ code: 'reconfirm_required' })).toBe('reconfirm_required');
    expect(challenge.problemCodeOf({ extensions: { code: 'two_factor_required' } })).toBe('two_factor_required');
    expect(challenge.problemCodeOf(null)).toBeUndefined();
    expect(challenge.problemCodeOf('x')).toBeUndefined();
    expect(challenge.problemCodeOf({ code: 4 })).toBeUndefined();
  });
});

describe('403 reconfirm_required', () => {
  it('asks once, then sends the same request again and answers with its result', async () => {
    const calls = script('reconfirm_required');
    const asker = vi.fn().mockResolvedValue(true);
    challenge.registerReconfirmAsker(asker);

    const res = await client.put('/api/v1/settings/company', { a: 1 });

    expect(asker).toHaveBeenCalledTimes(1);
    expect(res.data).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe('/api/v1/settings/company');
    expect(calls[1].method).toBe('put');
    expect(JSON.parse(String(calls[1].data))).toEqual({ a: 1 });
  });

  it('asks only once for requests refused together', async () => {
    script('reconfirm_required', 'reconfirm_required');
    let release: (v: boolean) => void = () => {};
    const asker = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve; }));
    challenge.registerReconfirmAsker(asker);

    const both = Promise.all([client.get('/api/v1/a'), client.get('/api/v1/b')]);
    await vi.waitFor(() => expect(asker).toHaveBeenCalled());
    release(true);
    const [a, b] = await both;

    expect(asker).toHaveBeenCalledTimes(1);
    expect(a.data).toEqual({ ok: true });
    expect(b.data).toEqual({ ok: true });
  });

  it('gives the refusal back unchanged when the person cancels the window', async () => {
    const calls = script('reconfirm_required');
    challenge.registerReconfirmAsker(vi.fn().mockResolvedValue(false));

    await expect(client.get('/api/v1/audit/changes')).rejects.toMatchObject({ response: { status: 403, data: { code: 'reconfirm_required' } } });
    expect(calls).toHaveLength(1);
  });

  it('retries at most once, even if the server asks again', async () => {
    const calls = script('reconfirm_required', 'reconfirm_required');
    const asker = vi.fn().mockResolvedValue(true);
    challenge.registerReconfirmAsker(asker);

    await expect(client.get('/api/v1/x')).rejects.toMatchObject({ response: { status: 403 } });
    expect(calls).toHaveLength(2);
    expect(asker).toHaveBeenCalledTimes(1);
  });

  it('is an ordinary refusal when no window is mounted', async () => {
    const calls = script('reconfirm_required');
    await expect(client.get('/api/v1/x')).rejects.toMatchObject({ response: { status: 403 } });
    expect(calls).toHaveLength(1);
  });

  it('leaves another 403 alone and still tells the account refresh', async () => {
    const calls = script('forbidden');
    challenge.registerReconfirmAsker(vi.fn().mockResolvedValue(true));
    const { onForbidden } = await import('./client');
    const listener = vi.fn();
    onForbidden(listener);

    await expect(client.get('/api/v1/x')).rejects.toMatchObject({ response: { status: 403 } });
    expect(calls).toHaveLength(1);
    expect(listener).toHaveBeenCalled();
  });
});

describe('403 two_factor_required', () => {
  it('raises the notice and does not retry', async () => {
    const calls = script('two_factor_required');
    const seen = vi.fn();
    challenge.subscribeTwoFactorRequired(seen);

    await expect(client.get('/api/v1/staff')).rejects.toMatchObject({ response: { status: 403 } });

    expect(challenge.twoFactorRequiredSnapshot()).toBe(true);
    expect(seen).toHaveBeenCalled();
    expect(calls).toHaveLength(1);

    challenge.setTwoFactorRequired(false);
    expect(challenge.twoFactorRequiredSnapshot()).toBe(false);
  });
});
