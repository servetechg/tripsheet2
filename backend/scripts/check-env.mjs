#!/usr/bin/env node
/**
 * Validates backend/.env against backend/.env.example and reports gaps.
 * Usage: npm run env:check
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const examplePath = path.join(backendRoot, '.env.example');
const envPath = path.join(backendRoot, '.env');

function parseEnvKeys(content) {
  const keys = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    keys.set(key, val);
  }
  return keys;
}

/** Optional — safe to omit in local dev. */
const OPTIONAL = new Set([
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_FOLDER',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'TENANT_RUNTIME_MODE',
  'AUTH_EXPOSE_RESET_URL',
  'PLATFORM_FROM_EMAIL',
  'PLATFORM_EMAIL_FROM_NAME',
  'PLATFORM_REPLY_TO',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_PORT',
  'SMTP_SECURE',
]);

/** Keys required for email delivery and cross-service calls in local dev. */
const REQUIRED = [
  'JWT_SECRET',
  'AUTH_SERVICE_URL',
  'COMPANY_SERVICE_URL',
  'DRIVER_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
  'AUTH_DATABASE_URL',
  'COMPANY_DATABASE_URL',
  'DRIVER_DATABASE_URL',
  'NOTIFICATION_DATABASE_URL',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'PLATFORM_FROM_EMAIL',
  'APP_PUBLIC_ORIGIN',
];

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

if (!existsSync(examplePath)) {
  console.error('Missing backend/.env.example');
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error('Missing backend/.env — run: npm run dev:setup');
  process.exit(1);
}

const example = parseEnvKeys(readFileSync(examplePath, 'utf8'));
const env = parseEnvKeys(readFileSync(envPath, 'utf8'));

const missingFromExample = [];
const missingOptional = [];
for (const key of example.keys()) {
  if (env.has(key)) continue;
  if (OPTIONAL.has(key)) missingOptional.push(key);
  else missingFromExample.push(key);
}

const emptyRequired = [];
for (const key of REQUIRED) {
  const val = env.get(key);
  if (val === undefined || val === '') emptyRequired.push(key);
}

const smtpOk = SMTP_KEYS.every((k) => {
  const v = env.get(k);
  return v !== undefined && v !== '' && !v.includes('your-');
});

console.log('backend/.env check\n');

if (missingFromExample.length) {
  console.log('Missing keys (present in .env.example):');
  for (const k of missingFromExample) console.log(`  - ${k}`);
  console.log('');
} else {
  console.log('All required .env.example keys are present in backend/.env');
}

if (missingOptional.length) {
  console.log('Optional keys not set (OK for local dev):');
  for (const k of missingOptional) console.log(`  - ${k}`);
  console.log('');
}

if (emptyRequired.length) {
  console.log('\nRequired keys missing or empty:');
  for (const k of emptyRequired) console.log(`  - ${k}`);
} else {
  console.log('Required keys for local dev are set.');
}

const platformFromSet = Boolean((env.get('PLATFORM_FROM_EMAIL') || '').trim());

if (smtpOk && platformFromSet) {
  console.log('SMTP configured (Model A) — platform From + tenant reply-to after restart.');
} else if (smtpOk) {
  console.log('SMTP relay configured.');
  console.warn(
    '  Set PLATFORM_FROM_EMAIL=noreply@yourdomain.com (different from SMTP_USER) for Model A.',
  );
} else {
  console.warn(
    '\nSMTP incomplete — emails stay queued until SMTP_* and PLATFORM_FROM_EMAIL are set.',
  );
}

const smtpUser = (env.get('SMTP_USER') || '').trim().toLowerCase();
const smtpFrom = (env.get('SMTP_FROM') || '').trim().toLowerCase();
const platformFrom = (env.get('PLATFORM_FROM_EMAIL') || '').trim().toLowerCase();
if (
  smtpUser &&
  !platformFrom &&
  smtpFrom &&
  smtpFrom === smtpUser
) {
  console.warn(
    '\n⚠ SMTP_FROM matches SMTP_USER (personal mailbox). Set PLATFORM_FROM_EMAIL for Model A.',
  );
}

const hasRedisUrl =
  (env.get('REDIS_URL') || '').length > 0 ||
  ((env.get('REDIS_HOST') || '').length > 0 &&
    (env.get('REDIS_PORT') || '').length > 0);
if (!hasRedisUrl) {
  console.warn('REDIS_URL or REDIS_HOST+REDIS_PORT not set — notification queue uses in-memory fallback.');
}

if (missingFromExample.length || emptyRequired.length) {
  console.log('\nFix: copy missing lines from backend/.env.example, then npm run env:sync');
  process.exit(1);
}

console.log('\nTip: one shared backend/.env loads into every service via preload-env.mjs');
