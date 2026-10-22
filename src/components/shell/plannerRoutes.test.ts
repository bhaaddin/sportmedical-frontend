/*
 * The two addresses of a club (Stage 5a): the PAGE `/clubs/:clubId` and the CALENDAR `/clubs/:clubId/kalendar`. Only the
 * calendar is the planner's stage; the order history `/clubs/objednavky/:orderId/historie` and the section pages are never
 * mistaken for a club.
 */
import { describe, expect, it } from 'vitest';
import { clubCalendarPath, clubIdOfRoute, clubPageIdOfRoute, clubPagePath, isPlannerRoute } from './plannerRoutes';

const ID = '942e2676-d730-4a13-8016-17f95abd26e2';

describe('clubPageIdOfRoute', () => {
  it('reads the id of a club page, with or without a trailing slash', () => {
    expect(clubPageIdOfRoute(`/clubs/${ID}`)).toBe(ID);
    expect(clubPageIdOfRoute(`/clubs/${ID}/`)).toBe(ID);
  });
  it.each([
    '/clubs', '/clubs/', '/clubs/objednavky', '/clubs/rezervace', '/clubs/hraci', '/clubs/statistiky', '/clubs/fakturace',
    `/clubs/${ID}/kalendar`, '/clubs/objednavky/o-1/historie', '/clubs/a/b/c', '/planovani', '/clubsx/1',
  ])('%s is not a club page', (path) => {
    expect(clubPageIdOfRoute(path)).toBeNull();
  });
});

describe('clubIdOfRoute (the calendar)', () => {
  it('reads the id of a club calendar', () => {
    expect(clubIdOfRoute(`/clubs/${ID}/kalendar`)).toBe(ID);
    expect(clubIdOfRoute(`/clubs/${ID}/kalendar/`)).toBe(ID);
  });
  it.each([
    `/clubs/${ID}`, '/clubs', '/clubs/objednavky', '/clubs/objednavky/kalendar', '/clubs/hraci/kalendar', '/clubs/objednavky/o-1/historie',
    `/clubs/${ID}/kalendar/x`, `/clubs/${ID}/historie`, '/planovani',
  ])('%s is not a club calendar', (path) => {
    expect(clubIdOfRoute(path)).toBeNull();
  });
  it('the history of an order is never a club id, whatever the order id looks like', () => {
    expect(clubIdOfRoute(`/clubs/objednavky/${ID}/historie`)).toBeNull();
    expect(clubPageIdOfRoute(`/clubs/objednavky/${ID}/historie`)).toBeNull();
    expect(isPlannerRoute(`/clubs/objednavky/${ID}/historie`)).toBe(false);
  });
});

describe('isPlannerRoute', () => {
  it("is the clinic's calendar, the lab and a club's calendar - not a club's page", () => {
    for (const p of ['/planovani', '/planner-lab', '/planner-lab/page', `/clubs/${ID}/kalendar`]) expect(isPlannerRoute(p)).toBe(true);
    for (const p of [`/clubs/${ID}`, '/clubs', '/clubs/objednavky', '/clubs/hraci', '/prehled', '/planovanizz']) expect(isPlannerRoute(p)).toBe(false);
  });
});

describe('the two paths', () => {
  it('are spelled in one place and belong to their predicates', () => {
    expect(clubPagePath(ID)).toBe(`/clubs/${ID}`);
    expect(clubCalendarPath(ID)).toBe(`/clubs/${ID}/kalendar`);
    expect(clubPageIdOfRoute(clubPagePath(ID))).toBe(ID);
    expect(clubIdOfRoute(clubCalendarPath(ID))).toBe(ID);
    expect(isPlannerRoute(clubPagePath(ID))).toBe(false);
    expect(isPlannerRoute(clubCalendarPath(ID))).toBe(true);
  });
  it('encode an id that is not url-safe', () => {
    expect(clubPagePath('a b')).toBe('/clubs/a%20b');
  });
});
