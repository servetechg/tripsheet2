/**
 * In-process MDM Phase 1 asset status / assignment checks.
 */
import {
  ASSET_STATUSES,
  ASSIGNABLE_ASSET_STATUSES,
  assetAssignmentBlockReason,
  canAssignAssetStatus,
  normalizeAssetStatus,
  DEFAULT_EQUIPMENT_TYPES,
} from './asset-status';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(ASSET_STATUSES.includes('out_of_service'), 'oos status');
assert(normalizeAssetStatus('active') === 'available', 'legacy active');
assert(normalizeAssetStatus('inactive') === 'retired', 'legacy inactive');
assert(normalizeAssetStatus('Out of Service') === 'out_of_service', 'spaces');
assert(canAssignAssetStatus('available'), 'available ok');
assert(canAssignAssetStatus('active'), 'legacy active assignable');
assert(canAssignAssetStatus('assigned'), 'assigned ok');
assert(!canAssignAssetStatus('out_of_service'), 'oos blocked');
assert(!canAssignAssetStatus('maintenance'), 'maintenance blocked');
assert(!canAssignAssetStatus('retired'), 'retired blocked');
assert(!canAssignAssetStatus('inactive'), 'legacy inactive blocked');
assert(
  assetAssignmentBlockReason('out_of_service', 'T-101').includes(
    'Out of Service',
  ),
  'oos reason',
);
assert(ASSIGNABLE_ASSET_STATUSES.length === 2, 'assignable set');
assert(DEFAULT_EQUIPMENT_TYPES.length === 11, 'equipment seed count');
assert(
  DEFAULT_EQUIPMENT_TYPES.some((t) => t.code === 'dry_van'),
  'dry van seed',
);

console.log('mdm asset status helpers ok');
