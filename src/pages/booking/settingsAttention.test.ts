import { describe, expect, it } from 'vitest';
import { activitiesAttention } from './activityAttention';
import { servicesAttention } from './clinicServiceState';

describe('activitiesAttention', () => {
  const a = (over: Record<string, unknown> = {}) => ({ id: 'a1', name: 'Prohlídka', isActive: true, priceCzk: 1500 as number | null, ...over });

  it('says nothing when every active činnost has a price', () => {
    expect(activitiesAttention([a(), a({ id: 'a2' })])).toBeNull();
  });

  it('counts the active ones without a price and sends each to Ceník; an archived one is not a problem', () => {
    const group = activitiesAttention([a({ priceCzk: null }), a({ id: 'a2', priceCzk: null, isActive: false }), a({ id: 'a3' })]);
    expect(group?.count).toBe(1);
    expect(group?.items[0].to).toBe('/nastaveni/cenik');
    expect(group?.action.to).toBe('/nastaveni/cenik');
  });
});

describe('servicesAttention', () => {
  const s = (over: Record<string, unknown> = {}) => ({ id: 's1', name: 'Prohlídky', isActive: true, activities: 2, calendars: 1, ...over });

  it('says nothing when every active služba has a činnost and a calendar', () => {
    expect(servicesAttention([s()])).toBeNull();
  });

  it('lists an active služba with no činnost or no calendar and opens that služba; an archived one is skipped', () => {
    const group = servicesAttention([s({ id: 'x', activities: 0 }), s({ id: 'y', calendars: 0 }), s({ id: 'z', activities: 0, isActive: false })]);
    expect(group?.count).toBe(2);
    expect(group?.items.map((i) => i.to)).toEqual(['/nastaveni/sluzby/x', '/nastaveni/sluzby/y']);
    expect(group?.items[0].detail).toBe('Nemá žádnou činnost.');
    expect(group?.items[1].detail).toBe('Žádný kalendář ji neprovozuje.');
  });
});
