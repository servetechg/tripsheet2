/**
 * In-process invite TTL helpers (Chapter 4 Phase 2).
 */
function clampInviteTtl(n: unknown, fallback = 7) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(90, Math.max(1, Math.trunc(v)));
}

function isInviteExpired(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(clampInviteTtl(7) === 7, 'default');
assert(clampInviteTtl(0) === 1, 'min 1');
assert(clampInviteTtl(999) === 90, 'max 90');
assert(clampInviteTtl('nope') === 7, 'fallback');
assert(
  isInviteExpired(new Date(Date.now() - 1000).toISOString()),
  'past expired',
);
assert(
  !isInviteExpired(new Date(Date.now() + 60_000).toISOString()),
  'future ok',
);
assert(!isInviteExpired(null), 'null not expired');

console.log('invite lifecycle helpers ok');
