import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./client', () => ({ client: { get, post }, default: { get, post } }));

import { exportsApi } from './exports';

describe('exportsApi.policy', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('reads allowed / forbidden from the server', async () => {
    get.mockResolvedValueOnce({ data: { allowed: true } });
    expect(await exportsApi.policy()).toBe('allowed');
    get.mockResolvedValueOnce({ data: { allowed: false } });
    expect(await exportsApi.policy()).toBe('forbidden');
    expect(get).toHaveBeenCalledWith('/api/v1/exports/policy');
  });

  it('treats a missing route (an older backend) as unsupported, not as a refusal', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    expect(await exportsApi.policy()).toBe('unsupported');
  });

  it('lets other failures through', async () => {
    get.mockRejectedValue({ response: { status: 500 } });
    await expect(exportsApi.policy()).rejects.toBeTruthy();
  });
});

describe('exportsApi.authorize', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('sends only the kind and a whole, non-negative count', async () => {
    post.mockResolvedValue({ status: 204 });
    await exportsApi.authorize('players-csv', 12.6);
    await exportsApi.authorize('players-csv', -4);
    expect(post).toHaveBeenNthCalledWith(1, '/api/v1/exports/authorize', { kind: 'players-csv', count: 13 });
    expect(post).toHaveBeenNthCalledWith(2, '/api/v1/exports/authorize', { kind: 'players-csv', count: 0 });
  });

  it('lets the file through on an older backend', async () => {
    post.mockRejectedValue({ response: { status: 404 } });
    await expect(exportsApi.authorize('statistics-csv', 3)).resolves.toBeUndefined();
  });

  it('throws the 403 so the helper can say it in Czech', async () => {
    post.mockRejectedValue({ response: { status: 403, data: { code: 'export.forbidden' } } });
    await expect(exportsApi.authorize('statistics-csv', 3)).rejects.toBeTruthy();
  });
});
