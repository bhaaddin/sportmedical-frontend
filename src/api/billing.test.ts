/*
 * `batchVerify` / `batchSubmit` must fail loudly when the server's answer does
 * not carry the key they promise to return.
 *
 * These two used to swallow a failed request and report success anyway, so
 * every selected invoice showed "Odesláno" although nothing had been sent and
 * nothing had been shown to the user. The guard that replaced that `catch` is
 * what these tests hold in place.
 *
 * What would have to break for these to fail: someone removes the
 * `assertBatchResult` call, widens it to accept any object, or changes the
 * required key without changing the caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('./client', () => ({ default: { post, get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const { billingApi } = await import('./billing');

beforeEach(() => post.mockReset());

describe('batchVerify', () => {
  it('returns the payload when it carries validIds', async () => {
    post.mockResolvedValue({ data: { validIds: ['a'], invalidIds: [] } });
    await expect(billingApi.batchVerify(['a'])).resolves.toEqual({
      validIds: ['a'],
      invalidIds: [],
    });
  });

  it('throws when the answer has no validIds, rather than reporting success', async () => {
    post.mockResolvedValue({ data: { message: 'neco jineho' } });
    await expect(billingApi.batchVerify(['a'])).rejects.toThrow(/validIds/);
  });

  it('throws on null, which is what an unwrapped empty body leaves behind', async () => {
    post.mockResolvedValue({ data: null });
    await expect(billingApi.batchVerify(['a'])).rejects.toThrow(/validIds/);
  });
});

describe('batchSubmit', () => {
  it('returns the payload when it carries succeededIds', async () => {
    post.mockResolvedValue({ data: { succeededIds: [], failedIds: ['x'] } });
    await expect(billingApi.batchSubmit(['x'])).resolves.toEqual({
      succeededIds: [],
      failedIds: ['x'],
    });
  });

  it('throws when the answer has no succeededIds', async () => {
    post.mockResolvedValue({ data: { validIds: [] } });
    await expect(billingApi.batchSubmit(['x'])).rejects.toThrow(/succeededIds/);
  });
});
