/* The batch summaries route: one call, tolerant reading, 404 / 405 remembered, long lists in chunks. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ default: { get, post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

const { clubSummariesApi, clubSummariesRouteMissing, resetClubSummariesRouteForTests, CLUB_SUMMARIES_CHUNK } = await import('./clubs');

const refusal = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => {
  resetClubSummariesRouteForTests();
  get.mockReset();
});

describe('clubSummariesApi.fetch', () => {
  it('asks once, ids joined by commas, and returns the list in the order the server gave it', async () => {
    get.mockResolvedValue({ data: [{ clubId: 'b' }, { clubId: 'a' }] });
    const rows = await clubSummariesApi.fetch(['b', 'a']);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/v1/clubs/summaries', { params: { clubIds: 'b,a' } });
    expect(rows).toEqual([{ clubId: 'b' }, { clubId: 'a' }]);
  });

  it('reads an enveloped list too', async () => {
    get.mockResolvedValue({ data: { data: [{ clubId: 'a' }] } });
    expect(await clubSummariesApi.fetch(['a'])).toEqual([{ clubId: 'a' }]);
    get.mockResolvedValue({ data: { value: [{ clubId: 'a' }] } });
    expect(await clubSummariesApi.fetch(['a'])).toEqual([{ clubId: 'a' }]);
  });

  it('asks nothing for no clubs', async () => {
    expect(await clubSummariesApi.fetch([])).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it.each([404, 405])('answers null on %i and remembers it: the next call makes no request', async (status) => {
    get.mockRejectedValue(refusal(status));
    expect(await clubSummariesApi.fetch(['a'])).toBeNull();
    expect(clubSummariesRouteMissing()).toBe(true);
    expect(await clubSummariesApi.fetch(['b'])).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 that is not a list as a missing route', async () => {
    get.mockResolvedValue({ data: '<html></html>' });
    expect(await clubSummariesApi.fetch(['a'])).toBeNull();
    expect(clubSummariesRouteMissing()).toBe(true);
  });

  it('throws other failures and does not remember them', async () => {
    get.mockRejectedValueOnce(refusal(500));
    await expect(clubSummariesApi.fetch(['a'])).rejects.toBeDefined();
    expect(clubSummariesRouteMissing()).toBe(false);
    get.mockResolvedValueOnce({ data: [{ clubId: 'a' }] });
    expect(await clubSummariesApi.fetch(['a'])).toEqual([{ clubId: 'a' }]);
  });

  it('splits a long list into several calls and joins the answers in order', async () => {
    const ids = Array.from({ length: CLUB_SUMMARIES_CHUNK + 5 }, (_, i) => `id-${i}`);
    get.mockImplementation(async (_url: string, config: { params: { clubIds: string } }) => ({
      data: config.params.clubIds.split(',').map((clubId) => ({ clubId })),
    }));
    const rows = (await clubSummariesApi.fetch(ids)) as { clubId: string }[];
    expect(get).toHaveBeenCalledTimes(2);
    expect(rows.map((r) => r.clubId)).toEqual(ids);
  });
});
