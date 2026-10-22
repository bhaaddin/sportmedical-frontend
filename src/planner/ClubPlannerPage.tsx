/*
 * `/clubs/:clubId/kalendar` - one club's screen: the planner in club mode (see `PlannerPage`, `club/`). The clubs LIST and the
 * other clubs pages keep the application shell; this route is a planner route (`plannerRoutes.ts`), so the shell draws
 * no sidebar around it, only the "Menu" button.
 *
 * The stage's early reads are handed out with the route (`warmReads.prefetchClubScreen` loads this module anyway), so
 * the warm-up adds no chunk of its own to the build.
 */
import { useParams } from 'react-router-dom';
import PlannerPage from './PlannerPage';

export { clubSelection, prefetchClubStage } from './club/clubStageReads';

export default function ClubPlannerPage() {
  const { clubId } = useParams();
  return <PlannerPage clubId={clubId} />;
}
