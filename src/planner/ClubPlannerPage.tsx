/*
 * `/clubs/:clubId` - one club's screen: the planner in club mode (see `PlannerPage`, `club/`). The clubs LIST and the
 * other clubs pages keep the application shell; this route is a planner route (`plannerRoutes.ts`), so the shell draws
 * no sidebar around it, only the "Menu" button.
 */
import { useParams } from 'react-router-dom';
import PlannerPage from './PlannerPage';

export default function ClubPlannerPage() {
  const { clubId } = useParams();
  return <PlannerPage clubId={clubId} />;
}
