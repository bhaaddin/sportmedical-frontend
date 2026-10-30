/*
 * `navigate(path, { state })` that also works where there is no router around the planner (the
 * lab's own tests render the shell alone): there it does nothing but report that it could not.
 */
import { useCallback } from 'react';
import { useInRouterContext, useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';

export interface SafeNavigation {
  /** False when there is no router: the entry points that need one hide. */
  available: boolean;
  pathname: string;
  /** The router state of the current entry (the hand-overs other screens leave), `null` without a router. */
  state: unknown;
  search: string;
  /** The history entry's key: a hand-over is applied once per key. */
  key: string;
  go: (path: string, options?: NavigateOptions) => void;
}

export function useSafeNavigate(): SafeNavigation {
  const inRouter = useInRouterContext();
  /* Conditional on a value that never changes for a mounted tree. */
  /* eslint-disable react-hooks/rules-of-hooks */
  const navigate = inRouter ? useNavigate() : null;
  const location = inRouter ? useLocation() : null;
  /* eslint-enable react-hooks/rules-of-hooks */
  const go = useCallback(
    (path: string, options?: NavigateOptions) => {
      if (navigate) navigate(path, options);
    },
    [navigate],
  );
  return { available: inRouter, pathname: location?.pathname ?? '/', state: location?.state ?? null, search: location?.search ?? '', key: location?.key ?? 'default', go };
}
