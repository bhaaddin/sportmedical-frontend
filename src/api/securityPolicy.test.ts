import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ client: { get, put, post }, default: { get, put, post } }));

import {
  DEFAULT_SECURITY_POLICY, isConfirmed, isRouteMissing, postReconfirm, readReconfirm, readSecurityPolicy, saveSecurityPolicy,
  securityPolicySchema,
} from './securityPolicy';
import { readSessions, revokeOtherSessions, revokeSession } from './accountSessions';

beforeEach(() => { get.mockReset(); put.mockReset(); post.mockReset(); });

describe('the security policy', () => {
  it('is all OFF by default, with the numbers 15 and 10', () => {
    expect(DEFAULT_SECURITY_POLICY).toEqual({
      reconfirmForAdmin: false, reconfirmMinutes: 15, requireTwoFactorForAdmins: false, adminIdleLock: false, adminIdleLockMinutes: 10,
    });
    expect(securityPolicySchema.safeParse(DEFAULT_SECURITY_POLICY).success).toBe(true);
  });

  it('rejects a wrong shape and a nonsense number', () => {
    expect(securityPolicySchema.safeParse({ ...DEFAULT_SECURITY_POLICY, reconfirmMinutes: 0 }).success).toBe(false);
    expect(securityPolicySchema.safeParse({ ...DEFAULT_SECURITY_POLICY, adminIdleLock: 'ano' }).success).toBe(false);
    expect(securityPolicySchema.safeParse({}).success).toBe(false);
  });

  it('reads the policy, bare or wrapped in { value }', async () => {
    get.mockResolvedValueOnce({ data: DEFAULT_SECURITY_POLICY });
    expect(await readSecurityPolicy()).toEqual(DEFAULT_SECURITY_POLICY);
    get.mockResolvedValueOnce({ data: { value: { ...DEFAULT_SECURITY_POLICY, adminIdleLock: true } } });
    expect((await readSecurityPolicy())?.adminIdleLock).toBe(true);
    expect(get).toHaveBeenCalledWith('/api/v1/settings/security-policy');
  });

  it('is null (the screen is hidden, silently) on a server without the route, or without the right to read it', async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await readSecurityPolicy()).toBeNull();
    get.mockRejectedValueOnce({ response: { status: 405 } });
    expect(await readSecurityPolicy()).toBeNull();
    get.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    expect(await readSecurityPolicy()).toBeNull();
    get.mockResolvedValueOnce({ data: { nonsense: true } });
    expect(await readSecurityPolicy()).toBeNull();
  });

  it('still throws a real failure, so the screen can say it did not load', async () => {
    get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(readSecurityPolicy()).rejects.toBeDefined();
  });

  it('tells a missing route from a "not found" the server means', () => {
    expect(isRouteMissing({ response: { status: 404 } })).toBe(true);
    expect(isRouteMissing({ response: { status: 404, data: { code: 'not_found' } } })).toBe(false);
    expect(isRouteMissing({ response: { status: 500 } })).toBe(false);
    expect(isRouteMissing(new Error('x'))).toBe(false);
  });

  it('saves with PUT and validates what it sends', async () => {
    put.mockResolvedValueOnce({ data: { ...DEFAULT_SECURITY_POLICY, adminIdleLock: true } });
    const saved = await saveSecurityPolicy({ ...DEFAULT_SECURITY_POLICY, adminIdleLock: true });
    expect(put).toHaveBeenCalledWith('/api/v1/settings/security-policy', { ...DEFAULT_SECURITY_POLICY, adminIdleLock: true });
    expect(saved.adminIdleLock).toBe(true);
    await expect(saveSecurityPolicy({ ...DEFAULT_SECURITY_POLICY, reconfirmMinutes: -3 })).rejects.toBeDefined();
  });
});

describe('the confirmation window', () => {
  it('reads confirmedAt / validUntil, and nulls on a server without the route', async () => {
    get.mockResolvedValueOnce({ data: { confirmedAt: '2026-11-01T10:00:00Z', validUntil: '2026-11-01T10:15:00Z' } });
    expect(await readReconfirm()).toEqual({ confirmedAt: '2026-11-01T10:00:00Z', validUntil: '2026-11-01T10:15:00Z' });
    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await readReconfirm()).toEqual({ confirmedAt: null, validUntil: null });
  });

  it('posts the password and the code (null without 2FA), and returns the window', async () => {
    post.mockResolvedValue({ data: { confirmedAt: 'a', validUntil: 'b' } });
    await postReconfirm({ password: 'p', code: null });
    expect(post).toHaveBeenCalledWith('/api/v1/session/reconfirm', { password: 'p', code: null });
    await postReconfirm({ password: 'p', code: '123456' });
    expect(post).toHaveBeenLastCalledWith('/api/v1/session/reconfirm', { password: 'p', code: '123456' });
  });

  it('is confirmed only while validUntil is in the future', () => {
    const now = Date.parse('2026-11-01T10:00:00Z');
    expect(isConfirmed({ confirmedAt: 'x', validUntil: '2026-11-01T10:00:01Z' }, now)).toBe(true);
    expect(isConfirmed({ confirmedAt: 'x', validUntil: '2026-11-01T09:59:59Z' }, now)).toBe(false);
    expect(isConfirmed({ confirmedAt: null, validUntil: null }, now)).toBe(false);
    expect(isConfirmed(undefined, now)).toBe(false);
    expect(isConfirmed({ confirmedAt: 'x', validUntil: 'garbage' }, now)).toBe(false);
  });
});

describe('my sessions', () => {
  it('reads them, filling a missing lastSeenAt and device with null', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 's1', createdAt: '2026-11-01T08:00:00Z', current: true }, { id: 's2', createdAt: 'x', lastSeenAt: 'y', device: 'Chrome · Windows', current: false }] });
    const rows = await readSessions();
    expect(rows).toEqual([
      { id: 's1', createdAt: '2026-11-01T08:00:00Z', lastSeenAt: null, device: null, current: true },
      { id: 's2', createdAt: 'x', lastSeenAt: 'y', device: 'Chrome · Windows', current: false },
    ]);
  });

  it('is null on a server without the route', async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await readSessions()).toBeNull();
  });

  it('revokes one by id (encoded) and all the others', async () => {
    post.mockResolvedValue({});
    await revokeSession('a/b');
    expect(post).toHaveBeenCalledWith('/api/v1/account/sessions/a%2Fb/revoke');
    await revokeOtherSessions();
    expect(post).toHaveBeenLastCalledWith('/api/v1/account/sessions/revoke-others');
  });
});
