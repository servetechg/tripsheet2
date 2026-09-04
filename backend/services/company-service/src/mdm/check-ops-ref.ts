/**
 * In-process MDM Phase 6 ops/finance helpers.
 */
import {
  buildOpsNormalizedKey,
  DEFAULT_COST_CENTERS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYROLL_CATEGORIES,
  isOpsCodedTable,
  isOpsNamedTable,
  REF_KIND_EXPENSE,
  slugOpsCode,
} from './ops-ref.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isOpsNamedTable('MaintenanceVendor'), 'vendor table');
assert(isOpsNamedTable('FuelStation'), 'fuel table');
assert(isOpsNamedTable('InsuranceProvider'), 'ins table');
assert(!isOpsNamedTable('Carrier'), 'not named');
assert(isOpsCodedTable('CostCenter'), 'cc');
assert(isOpsCodedTable('PayrollCategory'), 'pay');
assert(buildOpsNormalizedKey('Pete\'s Shop!') === 'petesshop', 'norm');
assert(slugOpsCode('fleet ops') === 'FLEET_OPS', 'slug');
assert(DEFAULT_COST_CENTERS.some((c) => c.code === 'FLEET'), 'cc seed');
assert(DEFAULT_PAYROLL_CATEGORIES.some((c) => c.code === 'MILEAGE'), 'pay seed');
assert(DEFAULT_EXPENSE_CATEGORIES.length >= 6, 'exp seed');
assert(REF_KIND_EXPENSE === 'expense_category', 'kind');

console.log('mdm ops-ref helpers ok');
