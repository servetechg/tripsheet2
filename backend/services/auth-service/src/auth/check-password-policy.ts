/**
 * In-process password policy checks (no live services).
 */
import {
  PLATFORM_PASSWORD_POLICY,
  assertPasswordMeetsPolicy,
  bannedSubstringsFromIdentity,
  policyFromRow,
} from './password.policy';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PLATFORM_PASSWORD_POLICY.minLength === 8, 'platform min');
assert(PLATFORM_PASSWORD_POLICY.historyCount === 10, 'platform history');
assert(
  assertPasswordMeetsPolicy('admin123', PLATFORM_PASSWORD_POLICY) === null,
  'seed-length passwords still valid when complexity off',
);
assert(
  assertPasswordMeetsPolicy('short', PLATFORM_PASSWORD_POLICY),
  'too short rejected',
);

const tight = policyFromRow({
  passwordMinLength: 8,
  passwordComplexity: true,
  passwordHistoryCount: 10,
  sessionDays: 7,
  lockoutThreshold: 5,
  lockoutMinutes: 15,
  idleTimeoutMinutes: 0,
});
assert(tight.minLength === 12, 'complexity raises floor to 12');
assert(tight.historyCount === 10, 'history from row');
assert(assertPasswordMeetsPolicy('admin123', tight), 'admin123 fails complexity');
assert(
  assertPasswordMeetsPolicy('Admin1234abc', tight),
  'needs special when complexity on',
);
assert(
  assertPasswordMeetsPolicy('Admin1234abc!', tight) === null,
  'complex with special ok',
);
assert(assertPasswordMeetsPolicy('ADMIN1234AB!', tight), 'needs lowercase');

const identity = { name: 'Jane Doe', email: 'jane.doe@fleet.com' };
assert(
  bannedSubstringsFromIdentity(identity).includes('jane'),
  'bans first name',
);
assert(
  assertPasswordMeetsPolicy('XxJane99!!ab', tight, identity),
  'name substring rejected',
);
assert(
  assertPasswordMeetsPolicy('XxFleet99!!ab', tight, identity) === null,
  'unrelated password ok',
);

const customMin = policyFromRow({
  passwordMinLength: 10,
  passwordComplexity: false,
  passwordHistoryCount: 0,
});
assert(customMin.minLength === 10, 'custom min without complexity');
assert(customMin.historyCount === 0, 'history can be off');

console.log('password policy ok');
