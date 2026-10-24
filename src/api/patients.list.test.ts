import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

const { patientsApi } = await import('./patients');

beforeEach(() => {
  get.mockReset();
});

describe('patientsApi.list includeCount', () => {
  it('sends nothing extra by default', async () => {
    get.mockResolvedValue({ data: { items: [], totalCount: 0 } });
    await patientsApi.list({ query: 'novak' });
    expect(get.mock.calls[0]![1].params.includeCount).toBeUndefined();
  });

  it('asks for a page without its count and passes on "has more"', async () => {
    get.mockResolvedValue({ data: { items: [], totalCount: -1, hasMore: true } });
    const page = await patientsApi.list({ query: 'novak', includeCount: false });
    expect(get.mock.calls[0]![1].params.includeCount).toBe(false);
    expect(page.hasMore).toBe(true);
  });

  it('an older server ignores it and counts: the count is there and there is no "has more"', async () => {
    get.mockResolvedValue({ data: { items: [{ id: '1' }], totalCount: 7 } });
    const page = await patientsApi.list({ includeCount: false });
    expect(page.totalCount).toBe(7);
    expect(page.hasMore).toBeUndefined();
  });
});
