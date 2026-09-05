// Role-Based Access Control (RBAC) permissions

export enum Permission {
  PATIENT_VIEW = 'patient:view',
  PATIENT_CREATE = 'patient:create',
  PATIENT_EDIT = 'patient:edit',
  PATIENT_DELETE = 'patient:delete',
  PATIENT_EXPORT = 'patient:export',

  APPOINTMENT_VIEW = 'appointment:view',
  APPOINTMENT_CREATE = 'appointment:create',
  APPOINTMENT_EDIT = 'appointment:edit',
  APPOINTMENT_CANCEL = 'appointment:cancel',
  APPOINTMENT_RESCHEDULE = 'appointment:reschedule',

  BILLING_VIEW = 'billing:view',
  BILLING_CREATE = 'billing:create',
  BILLING_EDIT = 'billing:edit',
  BILLING_PROCESS_PAYMENT = 'billing:process-payment',
  BILLING_REFUND = 'billing:refund',

  STAFF_VIEW = 'staff:view',
  STAFF_CREATE = 'staff:create',
  STAFF_EDIT = 'staff:edit',
  STAFF_DELETE = 'staff:delete',

  SETTINGS_VIEW = 'settings:view',
  SETTINGS_EDIT = 'settings:edit',

  REPORT_VIEW = 'report:view',
  REPORT_CREATE = 'report:create',
  REPORT_EXPORT = 'report:export',

  ADMIN_USERS = 'admin:users',
  ADMIN_ROLES = 'admin:roles',
  ADMIN_AUDIT = 'admin:audit',
  ADMIN_BACKUP = 'admin:backup',

  SYSTEM_HEALTH = 'system:health',
  SYSTEM_LOGS = 'system:logs',
}

export enum Role {
  SUPER_ADMIN = 'SuperAdmin',
  ADMIN = 'Admin',
  HEAD_PHYSICIAN = 'HeadPhysician',
  DOCTOR = 'Doctor',
  NURSE = 'Nurse',
  RECEPTIONIST = 'Receptionist',
  PATIENT = 'Patient',
}

export const roleHierarchy: Record<Role, Role[]> = {
  [Role.SUPER_ADMIN]: [Role.ADMIN, Role.HEAD_PHYSICIAN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT],
  [Role.ADMIN]: [Role.HEAD_PHYSICIAN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST],
  [Role.HEAD_PHYSICIAN]: [Role.DOCTOR, Role.NURSE],
  [Role.DOCTOR]: [Role.NURSE],
  [Role.NURSE]: [],
  [Role.RECEPTIONIST]: [],
  [Role.PATIENT]: [],
};

export const rolePermissions: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission),
  [Role.ADMIN]: [
    Permission.PATIENT_VIEW, Permission.PATIENT_CREATE, Permission.PATIENT_EDIT,
    Permission.APPOINTMENT_VIEW, Permission.APPOINTMENT_CREATE, Permission.APPOINTMENT_EDIT,
    Permission.BILLING_VIEW, Permission.BILLING_CREATE, Permission.BILLING_EDIT,
    Permission.STAFF_VIEW, Permission.STAFF_CREATE, Permission.STAFF_EDIT,
    Permission.SETTINGS_VIEW, Permission.SETTINGS_EDIT,
    Permission.REPORT_VIEW, Permission.REPORT_CREATE, Permission.REPORT_EXPORT,
    Permission.ADMIN_USERS, Permission.ADMIN_ROLES, Permission.ADMIN_AUDIT, Permission.ADMIN_BACKUP,
  ],
  [Role.HEAD_PHYSICIAN]: [
    Permission.PATIENT_VIEW, Permission.PATIENT_CREATE, Permission.PATIENT_EDIT,
    Permission.APPOINTMENT_VIEW, Permission.APPOINTMENT_CREATE, Permission.APPOINTMENT_EDIT,
    Permission.BILLING_VIEW, Permission.REPORT_VIEW, Permission.REPORT_CREATE, Permission.STAFF_VIEW,
  ],
  [Role.DOCTOR]: [
    Permission.PATIENT_VIEW, Permission.PATIENT_CREATE, Permission.PATIENT_EDIT,
    Permission.APPOINTMENT_VIEW, Permission.APPOINTMENT_CREATE, Permission.APPOINTMENT_EDIT,
    Permission.REPORT_VIEW,
  ],
  [Role.NURSE]: [
    Permission.PATIENT_VIEW, Permission.APPOINTMENT_VIEW, Permission.APPOINTMENT_CREATE,
  ],
  [Role.RECEPTIONIST]: [
    Permission.PATIENT_VIEW, Permission.PATIENT_CREATE,
    Permission.APPOINTMENT_VIEW, Permission.APPOINTMENT_CREATE, Permission.APPOINTMENT_EDIT,
    Permission.BILLING_VIEW, Permission.BILLING_CREATE,
  ],
  [Role.PATIENT]: [
    Permission.APPOINTMENT_VIEW,
  ],
};
