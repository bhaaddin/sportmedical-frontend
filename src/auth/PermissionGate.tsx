/* ══════════════════════════════════════════════════════════════
   PERMISSION GATE COMPONENT
   Wraps children, hides/disables if user lacks permission.
   ══════════════════════════════════════════════════════════════ */
import type { ReactNode } from 'react';
import { Tooltip } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { roleHasPermission, type Permission } from './rbac';

interface Props {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
  showDisabled?: boolean; // if true, render disabled instead of hiding
}

export default function PermissionGate({ permission, children, fallback, showDisabled = false }: Props) {
  const role = useAppStore((s) => s.currentUserRole);
  const allowed = roleHasPermission(role, permission);

  if (allowed) return <>{children}</>;

  if (showDisabled) {
    return (
      <Tooltip title="Nemáte oprávnění" arrow>
        <span style={{ opacity: 0.4, pointerEvents: 'none', display: 'inline-block' }}>
          {children}
        </span>
      </Tooltip>
    );
  }

  return fallback ? <>{fallback}</> : null;
}
