/*
 * The routes where the planner's own stage is the whole screen: `/planovani` (the calendar) and the lab pages
 * `/planner-lab`, `/planner-lab/page`. The stage carries its own navigation inside the design (mini calendar,
 * header strip), so the shell draws NO sidebar and NO tablet rail there - only a "Menu" button in the
 * where-am-I row that opens the same navigation as a slide-over drawer (see PlannerMenu.tsx).
 * The phone keeps its bottom navigation as everywhere else.
 */
const PLANNER_PREFIXES = ['/planovani', '/planner-lab'] as const;

export function isPlannerRoute(pathname: string): boolean {
  return PLANNER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
