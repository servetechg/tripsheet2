/**
 * In-process password-reset token hashing checks (Chapter 4 Phase 2).
 */
import { createHash } from 'crypto';

function hashResetToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = hashResetToken('abc');
const b = hashResetToken('abc');
const c = hashResetToken('xyz');
assert(a === b, 'deterministic');
assert(a !== c, 'different inputs');
assert(a.length === 64, 'sha256 hex');

console.log('password reset helpers ok');
