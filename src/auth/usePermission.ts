/* ══════════════════════════════════════════════════════════════
   USE PERMISSION HOOK
   React-idiomatic hook that re-renders when role changes.
   Returns boolean for a given permission string.
   ══════════════════════════════════════════════════════════════ */
import { useAppStore } from '../store/useAppStore';
import { roleHasPermission, type Permission } from './rbac';

/**
 * Check if the current user has a specific permission.
 * Automatically re-renders if the user's role changes mid-session.
 *
 * @example
 * const canDelete = usePermission('calendar:delete_others');
 * if (canDelete) { ... }
 */
export function usePermission(permission: Permission): boolean {
  const role = useAppStore((s) => s.currentUserRole);
  return roleHasPermission(role, permission);
}

/**
 * Check multiple permissions at once (returns object).
 *
 * @example
 * const perms = usePermissions(['calendar:create', 'billing:process_batch']);
 * if (perms.calendarCreate) { ... }
 */
export function usePermissions<T extends readonly Permission[]>(permissions: T): Record<T[number], boolean> {
  const role = useAppStore((s) => s.currentUserRole);
  const result = {} as Record<T[number], boolean>;
  for (const p of permissions) {
    result[p] = roleHasPermission(role, p);
  }
  return result;
}
