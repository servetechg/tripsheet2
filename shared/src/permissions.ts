/** JWT / UI permission helpers. Deny by default. */

export function hasPermission(
  permissions: string[] | undefined | null,
  code: string,
): boolean {
  return Boolean(code && permissions?.includes(code));
}

export function hasAnyPermission(
  permissions: string[] | undefined | null,
  codes: string[],
): boolean {
  return codes.some((c) => hasPermission(permissions, c));
}

/** Tab id → permission required to show it. `null` = any in-tenant staff. */
export const TAB_PERMISSION: Record<string, string | string[] | null> = {
  dashboard: null,
  dispatch: 'dispatch.view',
  track: 'dispatch.view',
  emanifest: ['dispatch.view', 'dispatch.docs'],
  drivers: ['drivers.create', 'drivers.edit', 'drivers.docs.view', 'dispatch.view'],
  assets: 'fleet.view',
  fleet: ['fleet.view', 'maintenance.view'],
  sheets: ['reports.view', 'dispatch.view'],
  messages: null,
  compliance: 'compliance.view',
  reports: 'reports.view',
  accounting: 'accounting.view',
  company: 'company.view',
  users: 'users.view',
};

export function canOpenTab(
  tabId: string,
  permissions: string[] | undefined | null,
  opts?: { ownerBypass?: boolean },
): boolean {
  if (opts?.ownerBypass) return true;
  const need = TAB_PERMISSION[tabId];
  if (need === undefined) return false;
  if (need === null) return true;
  if (Array.isArray(need)) return hasAnyPermission(permissions, need);
  return hasPermission(permissions, need);
}
