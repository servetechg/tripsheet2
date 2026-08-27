/**
 * In-process RBAC gate checks (no live services required).
 */
import { resolvePermissionGate, isPlatformAdminPath } from './route-permissions';

function expectAllow(
  method: string,
  path: string,
  role: string,
  permissions?: string[],
) {
  const d = resolvePermissionGate({ method, path, role, permissions });
  if (!d.allow) {
    throw new Error(`${method} ${path} as ${role} should allow, got deny ${d.permission}`);
  }
}

function expectDeny(
  method: string,
  path: string,
  role: string,
  permissions: string[],
  audit?: boolean,
) {
  const d = resolvePermissionGate({ method, path, role, permissions });
  if (d.allow) {
    throw new Error(`${method} ${path} as ${role} should deny`);
  }
  if (audit && !d.auditDispatch) {
    throw new Error(`${method} ${path} should audit dispatch deny`);
  }
}

expectAllow('POST', '/api/auth/login', '');
expectAllow('GET', '/api/loads', 'superadmin', []);
expectAllow('GET', '/api/loads', 'company_owner', []);
expectAllow('PATCH', '/api/loads/abc', 'company_admin', []);
expectAllow('GET', '/api/loads', 'accountant', ['dispatch.view', 'accounting.view']);
expectDeny('PATCH', '/api/loads/abc', 'accountant', ['dispatch.view', 'accounting.view'], true);
expectDeny('POST', '/api/loads', 'accountant', ['dispatch.view'], true);
expectAllow('POST', '/api/loads', 'dispatcher', ['dispatch.create', 'dispatch.view']);
expectDeny('PUT', '/api/contracts/1', 'dispatcher', ['dispatch.view', 'dispatch.create']);
expectAllow('GET', '/api/contracts', 'accountant', ['drivers.wage.view']);
expectDeny('POST', '/api/companies', 'company_owner', []);
if (!isPlatformAdminPath('POST', '/api/companies')) {
  throw new Error('create company is platform-admin');
}
expectDeny('GET', '/api/tenants', 'company_owner', []);
expectAllow('GET', '/api/companies/c1/entitlements', 'dispatcher', []);
expectAllow('POST', '/api/invites', 'company_owner', []);
expectAllow('POST', '/api/auth/users', 'general_manager', ['users.create']);
expectDeny('POST', '/api/auth/users', 'dispatcher', ['dispatch.create', 'users.view']);
expectAllow(
  'GET',
  '/api/companies/c1/custom-roles',
  'hr_manager',
  ['users.view'],
);
expectAllow(
  'POST',
  '/api/companies/c1/custom-roles',
  'hr_manager',
  ['users.assign_role'],
);
expectDeny(
  'POST',
  '/api/companies/c1/custom-roles',
  'dispatcher',
  ['dispatch.create', 'users.view', 'company.edit'],
);
expectAllow('POST', '/api/companies/c1/custom-roles', 'company_owner', []);

expectAllow('POST', '/api/auth/forgot-password', '');
expectAllow('POST', '/api/auth/reset-password', '');
expectAllow('POST', '/api/auth/refresh', '');
expectAllow('POST', '/api/auth/mfa/challenge', '');
expectAllow('POST', '/api/auth/mfa/enroll-login/start', '');
expectAllow('POST', '/api/auth/mfa/enroll-login/confirm', '');
expectAllow(
  'POST',
  '/api/auth/users/u1/unlock',
  'company_owner',
  ['users.suspend'],
);
expectDeny(
  'POST',
  '/api/auth/users/u1/unlock',
  'dispatcher',
  ['users.view', 'users.create'],
);
expectAllow('POST', '/api/auth/change-password', 'dispatcher', ['dispatch.view']);
expectAllow('POST', '/api/auth/logout-all', 'accountant', ['accounting.view']);
expectAllow('GET', '/api/auth/login-history', 'dispatcher', ['dispatch.view']);
expectAllow(
  'PATCH',
  '/api/auth/users/u1',
  'hr_manager',
  ['users.suspend'],
);
expectDeny(
  'PATCH',
  '/api/auth/users/u1',
  'dispatcher',
  ['dispatch.view', 'dispatch.create'],
);

expectAllow('GET', '/api/loads', 'driver', ['dispatch.view']);
expectDeny('POST', '/api/loads', 'driver', ['dispatch.view', 'payroll.view']);
expectDeny('GET', '/api/invoices', 'dispatcher', ['dispatch.view', 'dispatch.create']);
expectAllow('GET', '/api/invoices', 'accountant', ['accounting.view', 'dispatch.view']);
expectAllow(
  'GET',
  '/api/companies/c1/mdm/export',
  'company_owner',
  [],
);
expectAllow(
  'GET',
  '/api/companies/c1/mdm/export',
  'dispatcher',
  ['company.locations'],
);
expectDeny(
  'GET',
  '/api/companies/c1/mdm/export',
  'dispatcher',
  ['dispatch.view', 'dispatch.create'],
);
expectAllow(
  'POST',
  '/api/companies/c1/mdm/import',
  'dispatcher',
  ['company.edit'],
);
expectDeny(
  'POST',
  '/api/companies/c1/mdm/import',
  'dispatcher',
  ['dispatch.create'],
);
expectAllow('GET', '/api/audit', 'company_owner', []);
expectDeny('GET', '/api/audit', 'dispatcher', ['dispatch.view', 'dispatch.create']);
expectDeny('POST', '/api/tenants/x/provision', 'dispatcher', ['dispatch.create']);
expectAllow('GET', '/api/settlements', 'driver', ['payroll.view']);

console.log('RBAC route gates ok');
