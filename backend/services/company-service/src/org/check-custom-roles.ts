/**
 * In-process custom-role sanitizer checks (no live services required).
 */
import {
  CUSTOM_ROLE_DENIED_PERMISSIONS,
  KNOWN_PERMISSION_CODES,
  isCustomRoleBaseRole,
  sanitizePermissionCodes,
  slugifyRoleCode,
} from './custom-role.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(KNOWN_PERMISSION_CODES.length === 55, 'catalog size drifted from auth');
assert(
  CUSTOM_ROLE_DENIED_PERMISSIONS.includes('company.delete'),
  'company.delete must stay denied on custom roles',
);
assert(isCustomRoleBaseRole('dispatcher'), 'dispatcher is a valid base role');
assert(!isCustomRoleBaseRole('company_owner'), 'owner must not be a custom base');
assert(!isCustomRoleBaseRole('superadmin'), 'superadmin must not be a custom base');

const clean = sanitizePermissionCodes([
  'dispatch.view',
  'dispatch.create',
  'company.delete',
  'not.a.perm',
  'dispatch.view',
  '',
]);
assert(clean.permissions.join(',') === 'dispatch.view,dispatch.create', 'kept');
assert(clean.denied.join(',') === 'company.delete', 'stripped delete');
assert(clean.rejected.join(',') === 'not.a.perm', 'rejected unknown');

assert(slugifyRoleCode('Payroll Clerk') === 'payroll_clerk', 'slug');
assert(slugifyRoleCode('  ') === 'custom_role', 'empty slug fallback');

console.log('custom-role sanitizer ok');
