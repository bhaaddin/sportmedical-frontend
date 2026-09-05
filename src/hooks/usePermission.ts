import { useMemo } from 'react';
import { Permission, Role, rolePermissions, roleHierarchy } from '../rbac/permissions';

// Simple auth state - reads from localStorage
function useCurrentUser() {
  return useMemo(() => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return null;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
      return { role: payload.role as Role | undefined };
    } catch {
      return null;
    }
  }, []);
}

export function usePermission() {
  const user = useCurrentUser();
  const userRole = user?.role;

  const allPermissions = useMemo((): Permission[] => {
    if (!userRole) return [];
    const permissions = new Set<Permission>();
    const direct = rolePermissions[userRole] || [];
    direct.forEach(p => permissions.add(p));
    const inherited = roleHierarchy[userRole] || [];
    inherited.forEach(role => {
      (rolePermissions[role] || []).forEach(p => permissions.add(p));
    });
    return Array.from(permissions);
  }, [userRole]);

  const hasPermission = useMemo(() => {
    return (permission: Permission): boolean => allPermissions.includes(permission);
  }, [allPermissions]);

  const hasAnyPermission = useMemo(() => {
    return (permissions: Permission[]): boolean => permissions.some(p => allPermissions.includes(p));
  }, [allPermissions]);

  const hasRole = useMemo(() => {
    return (role: Role): boolean => {
      if (!userRole) return false;
      if (userRole === role) return true;
      return (roleHierarchy[userRole] || []).includes(role);
    };
  }, [userRole]);

  const hasAnyRole = useMemo(() => {
    return (roles: Role[]): boolean => roles.some(role => hasRole(role));
  }, [hasRole]);

  const highestRole = useMemo((): Role | null => {
    if (!userRole) return null;
    const order = [Role.SUPER_ADMIN, Role.ADMIN, Role.HEAD_PHYSICIAN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT];
    const idx = order.indexOf(userRole);
    return idx >= 0 ? order[idx] : null;
  }, [userRole]);

  return { userRole, allPermissions, hasPermission, hasAnyPermission, hasRole, hasAnyRole, highestRole };
}
