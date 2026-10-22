/*
 * The routes where the planner's own stage is the whole screen: `/planovani` (the calendar), a club's calendar
 * `/clubs/:clubId/kalendar` (the planner in club mode) and the lab pages `/planner-lab`, `/planner-lab/page`. The stage
 * carries its own navigation inside the design (mini calendar, header strip), so the shell draws NO sidebar and NO tablet
 * rail there - only a "Menu" button in the where-am-I row that opens the same navigation as a slide-over drawer (see
 * PlannerMenu.tsx). The phone keeps its bottom navigation as everywhere else.
 *
 * A club has TWO addresses (Stage 5a, R7): `/clubs/:clubId` is the club's own PAGE (statistics, orders, players - an
 * ordinary page inside the shell with its sidebar) and `/clubs/:clubId/kalendar` is its calendar (the stage). The clubs
 * LIST (`/clubs`) and the clubs' other pages (`/clubs/objednavky`, `/hraci`, `/statistiky`, `/fakturace`, the order
 * history `/clubs/objednavky/:orderId/historie`) are ordinary pages as well.
 */
const PLANNER_PREFIXES = ['/planovani', '/planner-lab'] as const;

/** The pages under `/clubs/` that are not a club's id. */
const CLUB_SECTIONS: readonly string[] = ['objednavky', 'rezervace', 'hraci', 'statistiky', 'fakturace'];

const idOf = (segment: string): string | null => (CLUB_SECTIONS.includes(segment) ? null : segment);

/** `/clubs/<id>` (the club's page) -> the id; null for every other address (the list, a section page, the calendar, deeper paths). */
export function clubPageIdOfRoute(pathname: string): string | null {
  const match = /^\/clubs\/([^/]+)\/?$/.exec(pathname);
  return match === null ? null : idOf(match[1] as string);
}

/** `/clubs/<id>/kalendar` (the club's calendar) -> the id; null for every other address. */
export function clubIdOfRoute(pathname: string): string | null {
  const match = /^\/clubs\/([^/]+)\/kalendar\/?$/.exec(pathname);
  return match === null ? null : idOf(match[1] as string);
}

/** The address of a club's page and of its calendar - the only places that spell them. */
export const clubPagePath = (clubId: string): string => `/clubs/${encodeURIComponent(clubId)}`;
export const clubCalendarPath = (clubId: string): string => `/clubs/${encodeURIComponent(clubId)}/kalendar`;

export function isPlannerRoute(pathname: string): boolean {
  return clubIdOfRoute(pathname) !== null || PLANNER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
