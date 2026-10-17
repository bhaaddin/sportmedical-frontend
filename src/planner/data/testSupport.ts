/*
 * Test-only helpers shared by the data / component tests (not exported from the barrels).
 */
import { plannedOf, totals, type PlannerContext } from '../model';
import { buildPlannerContext, mergeSessions, type PlannerDataSource } from './PlannerDataSource';

export { plannedOf, totals };

/** The same reads `usePlannerModel` performs, as one awaited context. */
export async function buildPlannerContext_forTest(source: PlannerDataSource, today = '2026-11-10'): Promise<PlannerContext> {
  const [catalogue, order, dayBudget, sessions, orderSessions] = await Promise.all([
    source.getCatalogue(),
    source.getOrder(),
    source.getDayBudget(),
    source.listSessions({ from: '2026-10-26', to: '2026-12-06' }),
    source.listOrderSessions(),
  ]);
  return buildPlannerContext({ catalogue, order, sessions: mergeSessions(sessions, orderSessions), dayBudget, today });
}
