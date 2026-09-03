/**
 * In-process MDM Phase 2 party/location helpers.
 */
import {
  buildLocationNormalizedKey,
  buildPartyNormalizedKey,
  canSelectPartyStatus,
  namesLikelyDuplicate,
  normalizePartyStatus,
  partySelectBlockReason,
} from './party-status';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizePartyStatus('BLACKLISTED') === 'blacklisted', 'status');
assert(canSelectPartyStatus('active'), 'active ok');
assert(canSelectPartyStatus('watch'), 'watch ok');
assert(!canSelectPartyStatus('inactive'), 'inactive blocked');
assert(!canSelectPartyStatus('blacklisted'), 'blacklist blocked');
assert(
  partySelectBlockReason('Broker', 'ABC', 'blacklisted').includes('blacklisted'),
  'reason',
);
assert(
  buildPartyNormalizedKey({ name: 'ABC Logistics Ltd.', mc: 'MC-12345' }) ===
    'mc:mc12345',
  'mc key wins',
);
assert(
  buildPartyNormalizedKey({ name: 'ABC Logistics' }).startsWith('nm:'),
  'name key',
);
assert(
  buildLocationNormalizedKey({
    line1: '100 Main St',
    city: 'Calgary',
    region: 'AB',
    postal: 'T2P 1J9',
    country: 'CA',
  }).includes('calgary'),
  'location key',
);
assert(namesLikelyDuplicate('ABC Logistics', 'ABC Logistics Ltd'), 'fuzzy name');
assert(!namesLikelyDuplicate('ABC', 'XYZ Corp'), 'different names');

console.log('mdm party helpers ok');
