/**
 * In-process MDM Phase 4 catalog helpers.
 */
import {
  buildCommodityNormalizedKey,
  canSelectCatalogStatus,
  DEFAULT_COMMODITIES,
} from './catalog.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(buildCommodityNormalizedKey('Auto Parts!') === 'autoparts', 'key');
assert(canSelectCatalogStatus('active'), 'active');
assert(!canSelectCatalogStatus('inactive'), 'inactive');
assert(DEFAULT_COMMODITIES.some((c) => c.hazmat), 'hazmat seed');
assert(DEFAULT_COMMODITIES.length >= 6, 'seed size');

console.log('mdm catalog helpers ok');
