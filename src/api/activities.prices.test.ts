/* R8: the activity list prices a činnost that has no price-list link from the price list itself. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./client', () => ({ default: { get, post: vi.fn(), put: vi.fn() }, client: { get, post: vi.fn(), put: vi.fn() } }));

const { activitiesApi, resetActivityPriceItems } = await import('./activities');

const activity = (name: string, over: Record<string, unknown> = {}) => ({
  id: name, name, slug: name, durationMinutes: 40, color: '#2B5C9B', isPubliclyBookable: true, sortOrder: 1, isActive: true,
  serviceItemId: null, priceCzk: null, clinicServiceId: 's1', ...over,
});

const route = (activities: unknown[], items: unknown[] | 'fail') =>
  get.mockImplementation(async (url: string) => {
    if (url === '/api/activities') return { data: { activities, warnings: [] } };
    if (url === '/api/services') {
      if (items === 'fail') throw new Error('forbidden');
      return { data: items };
    }
    throw new Error(url);
  });

beforeEach(() => { get.mockReset(); resetActivityPriceItems(); });

describe('activitiesApi.list - list prices (R8)', () => {
  it('fills the price of an unlinked činnost from the price-list item of the same name', async () => {
    route([activity('Základní sportovní prohlídka'), activity('Komplexní', { priceCzk: 2200, serviceItemId: 'i2' })], [
      { id: 'i1', name: 'Základní sportovní prohlídka', priceCzk: 1600, isActive: true },
      { id: 'i2', name: 'Komplexní', priceCzk: 2200, isActive: true },
    ]);
    const { activities } = await activitiesApi.list();
    expect(activities.map((a) => a.priceCzk)).toEqual([1600, 2200]);
  });

  it('leaves a činnost without any price in the list as bez ceny, and an archived one alone', async () => {
    route([activity('Nic'), activity('Archiv', { isActive: false })], [{ id: 'i1', name: 'Archiv', priceCzk: 100, isActive: true }]);
    const { activities } = await activitiesApi.list();
    expect(activities.map((a) => a.priceCzk)).toEqual([null, null]);
  });

  it('keeps the list when the price list cannot be read', async () => {
    route([activity('Základní sportovní prohlídka')], 'fail');
    const { activities } = await activitiesApi.list();
    expect(activities[0]!.priceCzk).toBeNull();
  });

  it('does not read the price list when every činnost is priced', async () => {
    route([activity('A', { priceCzk: 1, serviceItemId: 'i' })], []);
    await activitiesApi.list();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
