/* Small helpers the plan dialogs share. */
import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';

/** Copy text to the clipboard and say so (or say it was blocked). Nothing is ever sent anywhere. */
export function useCopy() {
  const act = usePlannerActions();
  return useCallback(
    async (text: string, done: string, blocked = 'Prohlížeč zablokoval kopírování; označte text ručně.') => {
      try {
        await navigator.clipboard.writeText(text);
        act.toast(done);
        return true;
      } catch {
        act.toast(blocked);
        return false;
      }
    },
    [act],
  );
}

interface NavigatorLike {
  push?: (to: { pathname: string; search?: string; hash?: string }, state?: unknown) => void;
}

/** "Zpět na klub": the club page of the application (the club list with the club opened). Null without a router. */
export function useGoToClub(clubId: string | null | undefined): (() => void) | null {
  const navigation = useContext(UNSAFE_NavigationContext) as { navigator?: NavigatorLike } | null;
  const navigator = navigation?.navigator ?? null;
  const act = usePlannerActions();
  if (!navigator?.push) return null;
  return () => {
    act.closeDialog();
    navigator.push!({ pathname: '/clubs' }, clubId ? { clubId } : undefined);
  };
}
