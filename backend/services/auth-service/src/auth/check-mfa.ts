/**
 * In-process MFA / TOTP checks (Chapter 4 Phase 5).
 */
import { decryptSecret, encryptSecret } from './mfa.crypto';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from './mfa.totp';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const secret = generateTotpSecret();
assert(secret.length >= 16, 'secret length');
const code = totpAt(secret);
assert(/^\d{6}$/.test(code), 'totp digits');
assert(verifyTotp(secret, code), 'verify current');
assert(!verifyTotp(secret, '000000') || code === '000000', 'reject wrong');

const url = otpauthUrl({ secret, email: 'a@b.com', issuer: 'FleetQuix' });
assert(url.startsWith('otpauth://totp/'), 'otpauth');

const master = 'test-mfa-key';
const enc = encryptSecret(secret, master);
assert(enc.startsWith('v1:'), 'enc prefix');
assert(decryptSecret(enc, master) === secret, 'roundtrip');

const codes = generateRecoveryCodes(10);
assert(codes.length === 10, '10 recovery');
assert(codes[0].includes('-'), 'format');
assert(
  hashRecoveryCode(codes[0]) === hashRecoveryCode(codes[0].toLowerCase()),
  'recovery hash case',
);

console.log('mfa helpers ok');
