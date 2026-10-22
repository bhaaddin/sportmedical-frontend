/* The planner's mount point of the guide: the hint UI is a chunk of its own, fetched when the planner is on screen. */
import { lazy, Suspense } from 'react';

const GuideHost = lazy(() => import('./GuideHost'));

export function GuideSlot() {
  return (
    <Suspense fallback={null}>
      <GuideHost />
    </Suspense>
  );
}
