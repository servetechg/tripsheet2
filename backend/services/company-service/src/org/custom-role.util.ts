/**
 * Custom-role composition rules (RBAC Phase 3).
 * Catalog codes must stay aligned with auth-service `rbac.catalog.ts`.
 * Base roles must stay aligned with `@tripsheet/shared` CUSTOM_ROLE_BASE_ROLES.
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

/** Never grantable on a tenant custom role — owner-only. */
export const CUSTOM_ROLE_DENIED_PERMISSIONS = ['company.delete'] as const;

export const KNOWN_PERMISSION_CODES = [
  'company.view',
  'company.edit',
  'company.locations',
  'company.billing.view',
  'company.billing.edit',
  'company.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.suspend',
  'users.delete',
  'users.reset_password',
  'users.assign_role',
  'drivers.create',
  'drivers.invite',
  'drivers.edit',
  'drivers.approve',
  'drivers.suspend',
  'drivers.archive',
  'drivers.docs.view',
  'drivers.docs.upload',
  'drivers.docs.delete',
  'drivers.wage.view',
  'drivers.wage.edit',
  'dispatch.view',
  'dispatch.create',
  'dispatch.edit',
  'dispatch.delete',
  'dispatch.assign',
  'dispatch.close',
  'dispatch.cancel',
  'dispatch.docs',
  'dispatch.override',
  'fleet.view',
  'fleet.create',
  'fleet.edit',
  'fleet.delete',
  'fleet.assign',
  'maintenance.view',
  'maintenance.schedule',
  'accounting.view',
  'settlement.create',
  'settlement.edit',
  'payroll.view',
  'payroll.process',
  'invoice.generate',
  'accounting.export',
  'reports.view',
  'reports.export',
  'reports.schedule',
  'compliance.view',
  'admin.settings',
  'admin.api_keys',
  'admin.security',
  'admin.audit',
] as const;

export function isCustomRoleBaseRole(role: string): role is CustomRoleBaseRole {
  return (CUSTOM_ROLE_BASE_ROLES as readonly string[]).includes(role);
}

export function slugifyRoleCode(name: string): string {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return s || 'custom_role';
}

export function sanitizePermissionCodes(input: unknown): {
  permissions: string[];
  rejected: string[];
  denied: string[];
} {
  const raw = Array.isArray(input) ? input.map((v) => String(v)) : [];
  const known = new Set<string>(KNOWN_PERMISSION_CODES);
  const deny = new Set<string>(CUSTOM_ROLE_DENIED_PERMISSIONS);
  const seen = new Set<string>();
  const permissions: string[] = [];
  const rejected: string[] = [];
  const denied: string[] = [];
  for (const code of raw) {
    const c = code.trim();
    if (!c) continue;
    if (deny.has(c)) {
      denied.push(c);
      continue;
    }
    if (!known.has(c)) {
      rejected.push(c);
      continue;
    }
    if (seen.has(c)) continue;
    seen.add(c);
    permissions.push(c);
  }
  return { permissions, rejected, denied };
}
