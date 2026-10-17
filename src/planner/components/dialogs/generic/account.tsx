/*
 * Who is signed in, for the profile chip and the profile dialog, and a navigation that also works
 * where there is no router (the planner lab's tests render the shell on its own).
 *
 * The person comes from what the sign-in left in this browser (`localStorage.user`, the same
 * record the application shell reads for its account row). `PlannerShell` may hand the header a
 * name explicitly; `PlannerAccountProvider` makes that name the one every dialog uses too.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { ROLE_LABELS, type UserAccountRole } from '../../../../api/userAccounts';

export interface PlannerAccountUser {
  displayName: string;
  /** Role as the server names it ("Owner") or already in Czech. */
  role?: string;
}

const AccountContext = createContext<PlannerAccountUser | null | undefined>(undefined);

export function PlannerAccountProvider({ user, children }: { user: { displayName: string; role?: string } | null | undefined; children: ReactNode }) {
  return <AccountContext.Provider value={user === undefined ? undefined : user}>{children}</AccountContext.Provider>;
}

/** What `localStorage.user` holds, as a person; null when nobody is signed in here. */
export function readStoredUser(): PlannerAccountUser | null {
  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as { firstName?: string; lastName?: string; role?: string; displayName?: string };
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || (u.displayName ?? '').trim();
    return name ? { displayName: name, ...(u.role ? { role: u.role } : {}) } : null;
  } catch {
    return null;
  }
}

/** The person for this planner: the one the page passed, else the stored sign-in. */
export function usePlannerUser(): PlannerAccountUser | null {
  const given = useContext(AccountContext);
  return useMemo(() => (given === undefined ? readStoredUser() : given), [given]);
}

export const roleLabel = (role: string | undefined): string => {
  if (!role) return '';
  return (ROLE_LABELS as Record<string, string>)[role as UserAccountRole] ?? role;
};

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** `navigate(path)`; a full page load when there is no router around the planner. */
export function useAppNavigate(): (path: string) => void {
  const inRouter = useInRouterContext();
  // The hook is called conditionally on a value that never changes for a mounted tree.
  const navigate = inRouter ? useNavigate() : null; // eslint-disable-line react-hooks/rules-of-hooks
  return useCallback(
    (path: string) => {
      if (navigate) navigate(path);
      else window.location.assign(path);
    },
    [navigate],
  );
}
