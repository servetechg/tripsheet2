export const ROLES = ['superadmin', 'company_admin', 'driver'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  company_admin: 'Company Admin',
  driver: 'Driver',
};
