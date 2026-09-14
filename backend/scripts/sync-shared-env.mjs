#!/usr/bin/env node
/**
 * Ensures backend/.env exists and documents SMTP for notification-service.
 * Run after editing backend/.env: npm run env:sync
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const example = path.join(backendRoot, '.env.example');
const env = path.join(backendRoot, '.env');

if (!existsSync(env)) {
  if (!existsSync(example)) {
    console.error('Missing backend/.env.example');
    process.exit(1);
  }
  copyFileSync(example, env);
  console.log('Created backend/.env from .env.example — set SMTP_* and restart services.');
} else {
  console.log('backend/.env exists');
}

const content = readFileSync(env, 'utf8');
const smtpOk = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].every((k) => {
  const m = content.match(new RegExp(`^${k}=(.+)$`, 'm'));
  return m && m[1].trim().length > 0;
});

if (smtpOk) {
  console.log('SMTP variables present in backend/.env — notification-service will send email after restart.');
} else {
  console.warn(
    'SMTP not fully configured in backend/.env (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM). Emails stay queued until set.',
  );
}

console.log(
  '\nTip: one shared backend/.env is loaded by every service via shared/env-config/preload-env.mjs',
);

const check = spawnSync(process.execPath, ['scripts/check-env.mjs'], {
  cwd: backendRoot,
  stdio: 'inherit',
});
if ((check.status ?? 1) !== 0) {
  process.exit(check.status ?? 1);
}
