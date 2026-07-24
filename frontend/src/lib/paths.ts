/** Canonical app paths and tab allow-lists */

export const PATHS = {
  login: '/login',
  invite: '/invite',
  admin: '/admin',
  app: '/app',
  driver: '/driver',
} as const;

export const SUPER_ADMIN_TABS = ['companies'] as const;
export const COMPANY_ADMIN_TABS = [
  'dashboard',
  'dispatch',
  'track',
  'emanifest',
  'drivers',
  'assets',
  'sheets',
  'reports',
  'accounting',
] as const;
export const DRIVER_TABS = ['sheets', 'docs', 'contract', 'status'] as const;

export type SuperAdminTab = (typeof SUPER_ADMIN_TABS)[number];
export type CompanyAdminTab = (typeof COMPANY_ADMIN_TABS)[number];
export type DriverTab = (typeof DRIVER_TABS)[number];

export function homePathForRole(role: string): string {
  if (role === 'superadmin') return `${PATHS.admin}/companies`;
  if (role === 'company_admin') return `${PATHS.app}/dashboard`;
  if (role === 'driver') return `${PATHS.driver}/sheets`;
  return PATHS.login;
}

export function adminTabPath(tab: string = 'companies') {
  return `${PATHS.admin}/${tab}`;
}

export function appTabPath(tab: string = 'dashboard') {
  return `${PATHS.app}/${tab}`;
}

export function driverTabPath(tab: string = 'sheets') {
  return `${PATHS.driver}/${tab}`;
}

export function isSuperAdminTab(tab: string | undefined): tab is SuperAdminTab {
  return !!tab && (SUPER_ADMIN_TABS as readonly string[]).includes(tab);
}

export function isCompanyAdminTab(
  tab: string | undefined,
): tab is CompanyAdminTab {
  return !!tab && (COMPANY_ADMIN_TABS as readonly string[]).includes(tab);
}

export function isDriverTab(tab: string | undefined): tab is DriverTab {
  return !!tab && (DRIVER_TABS as readonly string[]).includes(tab);
}
