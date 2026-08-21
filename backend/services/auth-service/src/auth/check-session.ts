/**
 * In-process session helper checks (Chapter 4 Phase 4).
 */
import {
  accessTokenMinutesFromEnv,
  deviceLabelFromUa,
  hashRefreshToken,
  isSessionIdle,
} from './session.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(hashRefreshToken('abc') === hashRefreshToken('abc'), 'deterministic');
assert(hashRefreshToken('abc') !== hashRefreshToken('xyz'), 'different');
assert(hashRefreshToken('abc').length === 64, 'sha256 hex');
assert(
  deviceLabelFromUa('Mozilla/5.0 (Windows NT 10.0) Chrome/120').includes(
    'Chrome',
  ),
  'chrome',
);
assert(deviceLabelFromUa('').includes('Unknown'), 'unknown');
assert(!isSessionIdle(new Date(), 30), 'fresh not idle');
assert(isSessionIdle(new Date(Date.now() - 40 * 60_000), 30), 'idle');
assert(!isSessionIdle(new Date(Date.now() - 40 * 60_000), 0), 'idle off');
assert(accessTokenMinutesFromEnv('15') === 15, 'access ttl');
assert(accessTokenMinutesFromEnv('1') === 5, 'access min 5');
assert(accessTokenMinutesFromEnv('99999') === 1440, 'access max');

console.log('session helpers ok');
