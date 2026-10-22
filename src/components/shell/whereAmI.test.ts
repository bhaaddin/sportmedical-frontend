import { describe, expect, it } from 'vitest';
import { computeCrumbs } from './whereAmI';

const crumbs = (pathname: string) => computeCrumbs({ pathname, patientId: null, settingsHere: null, menu: [] });

describe("the trail over a club's page and calendar", () => {
  it('a club page: Kluby a týmy › Klub', () => {
    expect(crumbs('/clubs/club-1')).toEqual([{ label: 'Kluby a týmy', to: '/clubs' }, { label: 'Klub' }]);
  });
  it("the club's calendar: the middle crumb leads back to the page", () => {
    expect(crumbs('/clubs/club-1/kalendar')).toEqual([{ label: 'Kluby a týmy', to: '/clubs' }, { label: 'Klub', to: '/clubs/club-1' }, { label: 'Kalendář' }]);
  });
  it('the order history is not a club', () => {
    expect(crumbs('/clubs/objednavky/o-1/historie').map((c) => c.label)).not.toContain('Klub');
  });
});
