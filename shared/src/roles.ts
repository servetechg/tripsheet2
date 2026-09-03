export const ROLES = [
  'superadmin',
  'company_owner',
  'general_manager',
  'dispatcher',
  'dispatcher_supervisor',
  'driver',
  'fleet_manager',
  'safety_manager',
  'accountant',
  'hr_manager',
  'maintenance_coordinator',
] as const;

export type Role = (typeof ROLES)[number];

/** Pre-RBAC JWT / API alias for company_owner. Accept on read; never write. */
export const LEGACY_COMPANY_ADMIN_ROLE = 'company_admin';

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  company_owner: 'Company Owner',
  general_manager: 'General Manager',
  dispatcher: 'Dispatcher',
  dispatcher_supervisor: 'Dispatcher Supervisor',
  driver: 'Driver',
  fleet_manager: 'Fleet Manager',
  safety_manager: 'Safety & Compliance',
  accountant: 'Accountant',
  hr_manager: 'HR / Driver Manager',
  maintenance_coordinator: 'Maintenance Coordinator',
};

export function normalizeRole(role: string | undefined | null): string {
  if (!role) return '';
  if (role === LEGACY_COMPANY_ADMIN_ROLE) return 'company_owner';
  return role;
}

export function isCompanyOwnerRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === 'company_owner';
}

export function isDriverRole(role: string | undefined | null): boolean {
  return role === 'driver';
}

export function isSuperAdminRole(role: string | undefined | null): boolean {
  return role === 'superadmin';
}

/** Roles that use the company app shell (/app), not Super Admin or driver. */
export const COMPANY_APP_ROLES = ROLES.filter(
  (r) => r !== 'superadmin' && r !== 'driver',
);

/**
 * Allowed `baseRole` values for tenant custom roles (not owner / superadmin).
 * Keep aligned with company-service `custom-role.util.ts`.
 */
export const CUSTOM_ROLE_BASE_ROLES = [
  'general_manager',
  'dispatcher',
  'dispatcher_supervisor',
  'driver',
  'fleet_manager',
  'safety_manager',
  'accountant',
  'hr_manager',
  'maintenance_coordinator',
] as const;

export type CustomRoleBaseRole = (typeof CUSTOM_ROLE_BASE_ROLES)[number];
