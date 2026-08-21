/**
 * In-process security notification helpers (Chapter 4 Phase 6).
 */
import {
  SECURITY_NOTIFY_TYPES,
  isSecurityNotifyType,
  securityEventSeverity,
  securityNotifyBody,
  securityNotifyPayload,
  securityNotifySubject,
} from './security-notify';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(SECURITY_NOTIFY_TYPES.includes('security.login'), 'login type');
assert(isSecurityNotifyType('security.lockout'), 'lockout type');
assert(!isSecurityNotifyType('nope'), 'reject unknown');

const payload = securityNotifyPayload({
  type: 'security.login',
  to: 'A@B.COM',
  companyId: 'c1',
  userId: 'u1',
  ip: '1.2.3.4',
  userAgent: 'Chrome',
});
assert(payload.to === 'a@b.com', 'email lower');
assert(payload.channel === 'email', 'channel');
assert(payload.status === 'queued', 'queued');
assert(payload.meta.type === 'security.login', 'meta type');
assert(payload.meta.category === 'security', 'category');
assert(payload.body.includes('1.2.3.4'), 'ip in body');
assert(
  securityNotifySubject('security.mfa_disabled').includes('MFA'),
  'subject',
);
assert(
  securityNotifyBody({
    type: 'security.invite_accepted',
    to: 'x@y.com',
  }).includes('invite'),
  'invite body',
);
assert(securityEventSeverity('security.lockout') === 'warning', 'severity');
assert(securityEventSeverity('security.login') === 'info', 'info');

console.log('security notify helpers ok');
