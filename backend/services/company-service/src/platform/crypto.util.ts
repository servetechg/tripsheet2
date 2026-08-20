import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Encrypt tenant connection strings at rest (AES-256-GCM).
 * Key material: PLATFORM_SECRETS_KEY (or JWT_SECRET fallback for local dev).
 */
export function getPlatformSecretsKey(): Buffer {
  const raw =
    process.env.PLATFORM_SECRETS_KEY ||
    process.env.JWT_SECRET ||
    'tripsheet-platform-dev-key-change-me';
  return createHash('sha256').update(raw).digest();
}

/** Returns base64(iv + tag + ciphertext) */
export function encryptSecret(plain: string, key = getPlatformSecretsKey()): string {
  if (!plain) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(
  payload: string,
  key = getPlatformSecretsKey(),
): string {
  if (!payload) return '';
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 28) throw new Error('Invalid ciphertext');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Normalize shortName → tenant slug (a-z0-9) */
export function toTenantSlug(shortName: string): string {
  const slug = shortName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);
  if (!slug) throw new Error('Invalid tenant slug');
  return slug;
}

export function tenantDbName(slug: string): string {
  return `fq_tenant_${slug}`;
}
