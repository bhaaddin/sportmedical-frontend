/* ══════════════════════════════════════════════════════════════
   ROLE-BASED ACCESS CONTROL (RBAC)
   5 roles, granular permissions, permission gate component
   ══════════════════════════════════════════════════════════════ */
import { useAppStore, type UserRole } from '../store/useAppStore';

/* ── Permission strings ── */
export type Permission =
  | 'calendar:create' | 'calendar:delete' | 'calendar:delete_others' | 'calendar:force_override'
  | 'billing:view' | 'billing:process_batch' | 'billing:force_submit'
  | 'patient:view' | 'patient:create' | 'patient:edit' | 'patient:view_sensitive'
  | 'diagnostics:create' | 'diagnostics:regenerate'
  | 'admin:manage_users' | 'admin:view_audit' | 'admin:edit_codebook' | 'admin:force_logout' | 'admin:system_lock'
  | 'staff:view' | 'staff:create' | 'staff:edit'
  | 'documents:view' | 'documents:create' | 'documents:sign'
  | 'settings:edit' | 'reports:view' | 'inventory:view' | 'inventory:edit';

/* ── Role → Permissions mapping ── */
const rolePermissions: Record<UserRole, Permission[]> = {
  SuperAdmin: [
    'calendar:create', 'calendar:delete', 'calendar:delete_others', 'calendar:force_override',
    'billing:view', 'billing:process_batch', 'billing:force_submit',
    'patient:view', 'patient:create', 'patient:edit', 'patient:view_sensitive',
    'diagnostics:create', 'diagnostics:regenerate',
    'admin:manage_users', 'admin:view_audit', 'admin:edit_codebook', 'admin:force_logout', 'admin:system_lock',
    'staff:view', 'staff:create', 'staff:edit',
    'documents:view', 'documents:create', 'documents:sign',
    'settings:edit', 'reports:view', 'inventory:view', 'inventory:edit',
  ],
  Admin: [
    'calendar:create', 'calendar:delete', 'calendar:delete_others', 'calendar:force_override',
    'billing:view', 'billing:process_batch', 'billing:force_submit',
    'patient:view', 'patient:create', 'patient:edit', 'patient:view_sensitive',
    'diagnostics:create', 'diagnostics:regenerate',
    'admin:manage_users', 'admin:view_audit', 'admin:edit_codebook', 'admin:force_logout',
    'staff:view', 'staff:create', 'staff:edit',
    'documents:view', 'documents:create', 'documents:sign',
    'settings:edit', 'reports:view', 'inventory:view', 'inventory:edit',
  ],
  HeadPhysician: [
    'calendar:create', 'calendar:delete', 'calendar:delete_others',
    'billing:view', 'billing:process_batch',
    'patient:view', 'patient:create', 'patient:edit', 'patient:view_sensitive',
    'diagnostics:create', 'diagnostics:regenerate',
    'staff:view', 'staff:create', 'staff:edit',
    'documents:view', 'documents:create', 'documents:sign',
    'settings:edit', 'reports:view', 'inventory:view',
  ],
  Doctor: [
    'calendar:create', 'calendar:delete',
    'billing:view',
    'patient:view', 'patient:create', 'patient:edit',
    'diagnostics:create', 'diagnostics:regenerate',
    'documents:view', 'documents:create',
    'reports:view', 'inventory:view',
  ],
  Nurse: [
    'calendar:create',
    'patient:view', 'patient:create',
    'diagnostics:create',
    'documents:view', 'documents:create',
    'inventory:view',
  ],
  Receptionist: [
    'calendar:create',
    'patient:view', 'patient:create',
    'billing:view',
    'documents:view',
    'inventory:view',
  ],
};

/* ── Check if current user has permission ── */
export function hasPermission(permission: Permission): boolean {
  const role = useAppStore.getState().currentUserRole;
  return rolePermissions[role]?.includes(permission) ?? false;
}

/* ── Check against a specific role ── */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/* ── Get all permissions for current role ── */
export function getCurrentPermissions(): Permission[] {
  const role = useAppStore.getState().currentUserRole;
  return rolePermissions[role] ?? [];
}

/* ── All available permissions (for admin UI) ── */
export const ALL_PERMISSIONS: { key: Permission; label: string; category: string }[] = [
  { key: 'calendar:create', label: 'Vytvořit termín', category: 'Kalendář' },
  { key: 'calendar:delete', label: 'Smazat svůj termín', category: 'Kalendář' },
  { key: 'calendar:delete_others', label: 'Smazat cizí termín', category: 'Kalendář' },
  { key: 'calendar:force_override', label: 'Vynutit přepsání', category: 'Kalendář' },
  { key: 'billing:view', label: 'Zobrazit fakturaci', category: 'Fakturace' },
  { key: 'billing:process_batch', label: 'Hromadné zpracování', category: 'Fakturace' },
  { key: 'billing:force_submit', label: 'Vynutit odeslání', category: 'Fakturace' },
  { key: 'patient:view', label: 'Zobrazit pacienty', category: 'Pacienti' },
  { key: 'patient:create', label: 'Vytvořit pacienta', category: 'Pacienti' },
  { key: 'patient:edit', label: 'Upravit pacienta', category: 'Pacienti' },
  { key: 'patient:view_sensitive', label: 'Citlivá data', category: 'Pacienti' },
  { key: 'diagnostics:create', label: 'Vytvořit diagnostiku', category: 'Diagnostika' },
  { key: 'diagnostics:regenerate', label: 'Přegenerovat analýzu', category: 'Diagnostika' },
  { key: 'admin:manage_users', label: 'Správa uživatelů', category: 'Administrace' },
  { key: 'admin:view_audit', label: 'Zobrazit audit log', category: 'Administrace' },
  { key: 'admin:edit_codebook', label: 'Upravit číselníky', category: 'Administrace' },
  { key: 'admin:force_logout', label: 'Vynutit odhlášení', category: 'Administrace' },
  { key: 'admin:system_lock', label: 'Uzamknout systém', category: 'Administrace' },
  { key: 'staff:view', label: 'Zobrazit zaměstnance', category: 'Lidé' },
  { key: 'staff:create', label: 'Vytvořit zaměstnance', category: 'Lidé' },
  { key: 'staff:edit', label: 'Upravit zaměstnance', category: 'Lidé' },
  { key: 'documents:view', label: 'Zobrazit dokumenty', category: 'Dokumenty' },
  { key: 'documents:create', label: 'Vytvořit dokument', category: 'Dokumenty' },
  { key: 'documents:sign', label: 'Podepsat dokument', category: 'Dokumenty' },
  { key: 'settings:edit', label: 'Upravit nastavení', category: 'Nastavení' },
  { key: 'reports:view', label: 'Zobrazit reporty', category: 'Reporty' },
  { key: 'inventory:view', label: 'Zobrazit sklad', category: 'Sklad' },
  { key: 'inventory:edit', label: 'Upravit sklad', category: 'Sklad' },
];

export const ALL_ROLES: UserRole[] = ['SuperAdmin', 'Admin', 'HeadPhysician', 'Doctor', 'Nurse', 'Receptionist'];
