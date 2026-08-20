/**
 * Import-time catalog invariants. Exits non-zero if the catalog is invalid.
 * Phase 5: persona grant matrix (Chapter 2.5 / 2.10).
 */
import { ALL_PERMISSION_CODES, SYSTEM_ROLES } from './rbac.catalog';

function role(code: string) {
  const r = SYSTEM_ROLES.find((x) => x.code === code);
  if (!r) throw new Error(`missing system role ${code}`);
  return r;
}

function has(code: string, perm: string) {
  return role(code).permissions.includes(perm);
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const owner = role('company_owner');
if (owner.permissions.length !== ALL_PERMISSION_CODES.length) {
  throw new Error('company_owner must be granted every catalog permission');
}

assert(has('company_owner', 'company.delete'), 'owner can delete company');
assert(!has('general_manager', 'company.delete'), 'GM cannot delete company');

assert(has('dispatcher', 'dispatch.create'), 'dispatcher dispatches');
assert(has('dispatcher', 'dispatch.edit'), 'dispatcher edits dispatch');
assert(!has('dispatcher', 'drivers.wage.edit'), 'dispatcher ≠ wage');
assert(!has('dispatcher', 'payroll.process'), 'dispatcher ≠ payroll');
assert(!has('dispatcher', 'accounting.view'), 'dispatcher ≠ accounting');

assert(has('accountant', 'dispatch.view'), 'accountant can view dispatch');
assert(!has('accountant', 'dispatch.edit'), 'accountant ≠ dispatch edit');
assert(!has('accountant', 'dispatch.create'), 'accountant ≠ dispatch create');
assert(has('accountant', 'accounting.view'), 'accountant accounting');
assert(has('accountant', 'drivers.wage.view'), 'accountant can view wage');
assert(!has('accountant', 'drivers.wage.edit'), 'accountant wage is view-only in v1 catalog');

assert(has('driver', 'dispatch.view'), 'driver views own dispatch');
assert(!has('driver', 'dispatch.create'), 'driver does not create dispatch');
assert(!has('driver', 'dispatch.edit'), 'driver does not edit others’ dispatch via catalog');
assert(has('driver', 'payroll.view'), 'driver payroll self');
assert(!has('driver', 'users.create'), 'driver is not user-admin');

assert(SYSTEM_ROLES.length === 10, '10 system roles');

console.log(
  `RBAC catalog ok: ${ALL_PERMISSION_CODES.length} permissions, ${SYSTEM_ROLES.length} system roles (persona matrix ok)`,
);
