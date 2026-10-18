/*
 * The routes where the planner's own stage is the whole screen: `/planovani` (the calendar), a club's own screen
 * `/clubs/:clubId` (the planner in club mode) and the lab pages `/planner-lab`, `/planner-lab/page`. The stage carries
 * its own navigation inside the design (mini calendar, header strip), so the shell draws NO sidebar and NO tablet rail
 * there - only a "Menu" button in the where-am-I row that opens the same navigation as a slide-over drawer (see
 * PlannerMenu.tsx). The phone keeps its bottom navigation as everywhere else.
 *
 * The clubs LIST (`/clubs`) and the clubs' other pages (`/clubs/objednavky`, `/rezervace`, `/hraci`, `/statistiky`,
 * `/fakturace`) are ordinary pages with the sidebar; only `/clubs/<id>` is the stage.
 */
const PLANNER_PREFIXES = ['/planovani', '/planner-lab'] as const;

/** The pages under `/clubs/` that are not a club's id. */
const CLUB_SECTIONS: readonly string[] = ['objednavky', 'rezervace', 'hraci', 'statistiky', 'fakturace'];

/** `/clubs/<id>` -> the id; null for every other address (the list, a section page, deeper paths). */
export function clubIdOfRoute(pathname: string): string | null {
  const match = /^\/clubs\/([^/]+)\/?$/.exec(pathname);
  if (match === null) return null;
  const segment = match[1] as string;
  return CLUB_SECTIONS.includes(segment) ? null : segment;
}

export function isPlannerRoute(pathname: string): boolean {
  return clubIdOfRoute(pathname) !== null || PLANNER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
