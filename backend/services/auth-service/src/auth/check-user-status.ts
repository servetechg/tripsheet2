/**
 * In-process user lifecycle checks (Chapter 4 Phase 1).
 */
import {
  ADMIN_SETTABLE_STATUSES,
  canAuthenticateStatus,
  isUserStatus,
  statusDenyReason,
  USER_STATUSES,
} from './user-status';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(USER_STATUSES.length === 7, 'seven lifecycle statuses');
assert(canAuthenticateStatus('active'), 'active may login');
assert(!canAuthenticateStatus('suspended'), 'suspended blocked');
assert(!canAuthenticateStatus('archived'), 'archived blocked');
assert(!canAuthenticateStatus('inactive'), 'inactive blocked');
assert(!canAuthenticateStatus('locked'), 'locked blocked');
assert(!canAuthenticateStatus('pending'), 'pending blocked');
assert(!canAuthenticateStatus('invited'), 'invited blocked');
assert(statusDenyReason('suspended').includes('suspended'), 'deny copy');
assert(isUserStatus('active') && !isUserStatus('nope'), 'isUserStatus');
assert(ADMIN_SETTABLE_STATUSES.has('archived'), 'admin may archive');
assert(!ADMIN_SETTABLE_STATUSES.has('pending'), 'pending via invite later');

console.log('user lifecycle status ok');
