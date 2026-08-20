/**
 * In-process password policy checks (no live services).
 */
import {
  PLATFORM_PASSWORD_POLICY,
  assertPasswordMeetsPolicy,
  policyFromRow,
} from './password.policy';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PLATFORM_PASSWORD_POLICY.minLength === 8, 'platform min');
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
  sessionDays: 7,
  lockoutThreshold: 5,
  lockoutMinutes: 15,
  idleTimeoutMinutes: 0,
});
assert(tight.minLength === 12, 'complexity raises floor to 12');
assert(assertPasswordMeetsPolicy('admin123', tight), 'admin123 fails complexity');
assert(assertPasswordMeetsPolicy('Admin1234abc', tight) === null, 'complex ok');
assert(assertPasswordMeetsPolicy('ADMIN1234AB', tight), 'needs lowercase');

const customMin = policyFromRow({ passwordMinLength: 10, passwordComplexity: false });
assert(customMin.minLength === 10, 'custom min without complexity');

console.log('password policy ok');
