/**
 * Chapter 2 v1 permission catalog + system role grants.
 * Seeded into auth_db; JWT carries permission codes.
 */
export type PermissionDef = {
  code: string;
  module: string;
  name: string;
  description?: string;
};

export type SystemRoleDef = {
  code: string;
  name: string;
  description: string;
  permissions: string[];
};

export const PERMISSIONS: PermissionDef[] = [
  { code: 'company.view', module: 'company', name: 'View company' },
  { code: 'company.edit', module: 'company', name: 'Edit company' },
  { code: 'company.locations', module: 'company', name: 'Manage locations' },
  { code: 'company.billing.view', module: 'company', name: 'View billing' },
  { code: 'company.billing.edit', module: 'company', name: 'Edit billing' },
  { code: 'company.delete', module: 'company', name: 'Delete company' },

  { code: 'users.view', module: 'users', name: 'View users' },
  { code: 'users.create', module: 'users', name: 'Create user' },
  { code: 'users.edit', module: 'users', name: 'Edit user' },
  { code: 'users.suspend', module: 'users', name: 'Suspend user' },
  { code: 'users.delete', module: 'users', name: 'Delete user' },
  { code: 'users.reset_password', module: 'users', name: 'Reset password' },
  { code: 'users.assign_role', module: 'users', name: 'Assign role' },

  { code: 'drivers.create', module: 'drivers', name: 'Create driver' },
  { code: 'drivers.invite', module: 'drivers', name: 'Invite driver' },
  { code: 'drivers.edit', module: 'drivers', name: 'Edit driver' },
  { code: 'drivers.approve', module: 'drivers', name: 'Approve driver' },
  { code: 'drivers.suspend', module: 'drivers', name: 'Suspend driver' },
  { code: 'drivers.archive', module: 'drivers', name: 'Archive driver' },
  { code: 'drivers.docs.view', module: 'drivers', name: 'View driver documents' },
  { code: 'drivers.docs.upload', module: 'drivers', name: 'Upload driver documents' },
  { code: 'drivers.docs.delete', module: 'drivers', name: 'Delete driver documents' },
  { code: 'drivers.wage.view', module: 'drivers', name: 'View wage' },
  { code: 'drivers.wage.edit', module: 'drivers', name: 'Edit wage' },

  { code: 'dispatch.view', module: 'dispatch', name: 'View dispatch' },
  { code: 'dispatch.create', module: 'dispatch', name: 'Create dispatch' },
  { code: 'dispatch.edit', module: 'dispatch', name: 'Edit dispatch' },
  { code: 'dispatch.delete', module: 'dispatch', name: 'Delete dispatch' },
  { code: 'dispatch.assign', module: 'dispatch', name: 'Assign driver/equipment' },
  { code: 'dispatch.close', module: 'dispatch', name: 'Close dispatch' },
  { code: 'dispatch.cancel', module: 'dispatch', name: 'Cancel dispatch' },
  { code: 'dispatch.docs', module: 'dispatch', name: 'Upload dispatch documents' },
  { code: 'dispatch.override', module: 'dispatch', name: 'Override dispatch conflicts' },

  { code: 'fleet.view', module: 'fleet', name: 'View fleet' },
  { code: 'fleet.create', module: 'fleet', name: 'Add truck/trailer' },
  { code: 'fleet.edit', module: 'fleet', name: 'Edit fleet' },
  { code: 'fleet.delete', module: 'fleet', name: 'Remove fleet unit' },
  { code: 'fleet.assign', module: 'fleet', name: 'Assign equipment' },
  { code: 'maintenance.view', module: 'fleet', name: 'View maintenance' },
  { code: 'maintenance.schedule', module: 'fleet', name: 'Schedule PM / work orders' },

  { code: 'accounting.view', module: 'accounting', name: 'View accounting' },
  { code: 'settlement.create', module: 'accounting', name: 'Create settlement' },
  { code: 'settlement.edit', module: 'accounting', name: 'Edit settlement' },
  { code: 'payroll.view', module: 'accounting', name: 'View payroll' },
  { code: 'payroll.process', module: 'accounting', name: 'Process payroll' },
  { code: 'invoice.generate', module: 'accounting', name: 'Generate invoice' },
  { code: 'accounting.export', module: 'accounting', name: 'Export accounting reports' },

  { code: 'reports.view', module: 'reports', name: 'View reports' },
  { code: 'reports.export', module: 'reports', name: 'Export reports' },
  { code: 'reports.schedule', module: 'reports', name: 'Schedule reports' },

  { code: 'compliance.view', module: 'compliance', name: 'View compliance' },

  { code: 'admin.settings', module: 'admin', name: 'Manage settings' },
  { code: 'admin.api_keys', module: 'admin', name: 'API keys' },
  { code: 'admin.security', module: 'admin', name: 'Security' },
  { code: 'admin.audit', module: 'admin', name: 'Audit logs' },
];

export const ALL_PERMISSION_CODES: string[] = PERMISSIONS.map((p) => p.code);

function except(...deny: string[]) {
  return ALL_PERMISSION_CODES.filter((c) => !deny.includes(c));
}

const DISPATCHER_PERMS = [
  'users.view',
  'drivers.create',
  'drivers.invite',
  'drivers.edit',
  'drivers.approve',
  'drivers.suspend',
  'drivers.archive',
  'drivers.docs.view',
  'drivers.docs.upload',
  'drivers.docs.delete',
  'dispatch.view',
  'dispatch.create',
  'dispatch.edit',
  'dispatch.delete',
  'dispatch.assign',
  'dispatch.close',
  'dispatch.cancel',
  'dispatch.docs',
  'fleet.view',
  'maintenance.view',
  'reports.view',
  'compliance.view',
];

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    code: 'company_owner',
    name: 'Company Owner',
    description: 'Full in-tenant access; company configuration, users, billing.',
    permissions: ALL_PERMISSION_CODES,
  },
  {
    code: 'general_manager',
    name: 'General Manager',
    description: 'All operations except deleting the company.',
    permissions: except('company.delete'),
  },
  {
    code: 'dispatcher',
    name: 'Dispatcher',
    description: 'Create and manage dispatches; cannot change wages or payroll.',
    permissions: DISPATCHER_PERMS,
  },
  {
    code: 'dispatcher_supervisor',
    name: 'Dispatcher Supervisor',
    description: 'Dispatcher plus override, reassign, and cancel authority.',
    permissions: [...DISPATCHER_PERMS, 'dispatch.override'],
  },
  {
    code: 'driver',
    name: 'Driver',
    description: 'Own dispatches, documents, and payroll only.',
    permissions: [
      'dispatch.view',
      'drivers.docs.view',
      'drivers.docs.upload',
      'payroll.view',
      'reports.view',
      'compliance.view',
    ],
  },
  {
    code: 'fleet_manager',
    name: 'Fleet Manager',
    description: 'Trucks, trailers, maintenance, and assignments.',
    permissions: [
      'fleet.view',
      'fleet.create',
      'fleet.edit',
      'fleet.delete',
      'fleet.assign',
      'maintenance.view',
      'maintenance.schedule',
      'drivers.docs.view',
      'dispatch.view',
      'reports.view',
      'compliance.view',
    ],
  },
  {
    code: 'safety_manager',
    name: 'Safety & Compliance Manager',
    description: 'Driver qualifications, documents, incidents, audit prep.',
    permissions: [
      'drivers.edit',
      'drivers.approve',
      'drivers.docs.view',
      'drivers.docs.upload',
      'drivers.docs.delete',
      'drivers.suspend',
      'compliance.view',
      'dispatch.view',
      'reports.view',
      'admin.audit',
    ],
  },
  {
    code: 'accountant',
    name: 'Accountant',
    description: 'Payroll, settlements, AR/AP; cannot dispatch or edit fleet.',
    permissions: [
      'accounting.view',
      'settlement.create',
      'settlement.edit',
      'payroll.view',
      'payroll.process',
      'invoice.generate',
      'accounting.export',
      'reports.view',
      'reports.export',
      'dispatch.view',
      'drivers.docs.view',
      'drivers.wage.view',
      'users.view',
    ],
  },
  {
    code: 'hr_manager',
    name: 'HR / Driver Manager',
    description: 'Onboarding, documents, approvals, employment records.',
    permissions: [
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
      'users.view',
      'users.create',
      'compliance.view',
      'reports.view',
    ],
  },
  {
    code: 'maintenance_coordinator',
    name: 'Maintenance Coordinator',
    description: 'Work orders, PM schedules, repairs, vendors.',
    permissions: [
      'maintenance.view',
      'maintenance.schedule',
      'fleet.view',
      'fleet.edit',
      'reports.view',
    ],
  },
];

/** Legacy JWT / API alias */
export function normalizeRoleCode(role: string | undefined | null): string {
  if (!role) return '';
  if (role === 'company_admin') return 'company_owner';
  return role;
}

function assertCatalog() {
  if (new Set(ALL_PERMISSION_CODES).size !== PERMISSIONS.length) {
    throw new Error('RBAC catalog has duplicate permission codes');
  }
  if (SYSTEM_ROLES.length !== 10) {
    throw new Error(`RBAC catalog expected 10 system roles, got ${SYSTEM_ROLES.length}`);
  }
  const known = new Set(ALL_PERMISSION_CODES);
  for (const role of SYSTEM_ROLES) {
    for (const code of role.permissions) {
      if (!known.has(code)) {
        throw new Error(`Role ${role.code} references unknown permission ${code}`);
      }
    }
  }
}

assertCatalog();
