/**
 * In-process MDM Phase 3 merge helpers.
 */
import {
  fleetFkColumnForEntity,
  isMdmMergeEntity,
  mergePartyFields,
} from './merge.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isMdmMergeEntity('Carrier'), 'Carrier ok');
assert(!isMdmMergeEntity('CarrierProfile'), 'not profile');
assert(fleetFkColumnForEntity('Carrier')?.column === 'carrierId', 'fk');
assert(fleetFkColumnForEntity('Location') === null, 'location no load party fk');

const merged = mergePartyFields(
  { name: 'ABC', mc: '', phone: '555' },
  { name: 'ABC Ltd', mc: 'MC123', phone: '999' },
  ['name', 'mc', 'phone'],
);
assert(merged.name === 'ABC', 'keep survivor name');
assert(merged.mc === 'MC123', 'fill blank mc');
assert(merged.phone === '555', 'keep survivor phone');

console.log('mdm merge helpers ok');
