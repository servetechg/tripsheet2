/** Canonical app paths and tab allow-lists */

import { isDriverRole, isSuperAdminRole } from '@tripsheet/shared';

export const PATHS = {
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  invite: '/invite',
  admin: '/admin',
  app: '/app',
  driver: '/driver',
  workspace: '/workspace',
} as const;

export const SUPER_ADMIN_TABS = ['companies', 'ops'] as const;
export const COMPANY_ADMIN_TABS = [
  'dashboard',
  'dispatch',
  'track',
  'emanifest',
  'drivers',
  'assets',
  'fleet',
  'sheets',
  'messages',
  'compliance',
  'reports',
  'accounting',
  'company',
  'users',
] as const;
export const DRIVER_TABS = ['sheets', 'docs', 'contract', 'status'] as const;

export type SuperAdminTab = (typeof SUPER_ADMIN_TABS)[number];
export type CompanyAdminTab = (typeof COMPANY_ADMIN_TABS)[number];
export type DriverTab = (typeof DRIVER_TABS)[number];

export function homePathForRole(role: string): string {
  if (isSuperAdminRole(role)) return `${PATHS.admin}/companies`;
  if (isDriverRole(role)) return `${PATHS.driver}/sheets`;
  if (role) return `${PATHS.app}/dashboard`;
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
