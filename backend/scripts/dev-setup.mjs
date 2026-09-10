#!/usr/bin/env node
/**
 * First-time (or new machine) local dev bootstrap.
 *
 * Usage (from backend/):
 *   npm run dev:setup
 *
 * Does: shared build, env files, npm installs, infra, migrate, platform seed.
 */
import { existsSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForPostgres } from './lib/wait-postgres.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

const ENV_TARGETS = [
  'gateway',
  'services/auth-service',
  'services/company-service',
  'services/driver-service',
  'services/fleet-service',
  'services/manifest-service',
  'services/tripsheet-service',
  'services/accounting-service',
  'services/notification-service',
];

function run(cwd, cmd, args = [], { optional = false } = {}) {
  console.log(`\n$ (${path.relative(REPO_ROOT, cwd) || '.'}) ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0 && !optional) {
    throw new Error(`Failed: ${cmd} ${args.join(' ')}`);
  }
  return result.status ?? 1;
}

function copyEnvFiles() {
  console.log('\n==> env files');
  for (const rel of ENV_TARGETS) {
    const dir = path.join(BACKEND_ROOT, rel);
    const src = path.join(dir, '.env.example');
    const dst = path.join(dir, '.env');
    if (!existsSync(src)) {
      console.warn(`skip  ${rel} (no .env.example)`);
      continue;
    }
    if (existsSync(dst)) {
      console.log(`keep  ${rel}/.env`);
    } else {
      copyFileSync(src, dst);
      console.log(`create ${rel}/.env`);
    }
  }
}

async function main() {
  console.log('\n==> TripSheet dev setup\n');

  const sharedDir = path.join(REPO_ROOT, 'shared');
  if (existsSync(sharedDir)) {
    run(sharedDir, 'npm', ['install']);
    run(sharedDir, 'npm', ['run', 'build']);
  }

  const tenantRuntime = path.join(BACKEND_ROOT, 'shared', 'tenant-runtime');
  if (existsSync(tenantRuntime)) {
    run(tenantRuntime, 'npm', ['install']);
    run(tenantRuntime, 'npm', ['run', 'build']);
  }

  run(BACKEND_ROOT, 'npm', ['install']);
  copyEnvFiles();
  run(BACKEND_ROOT, 'npm', ['run', 'install:all']);

  console.log('\n==> infrastructure');
  run(BACKEND_ROOT, 'docker', ['compose', 'up', '-d']);
  waitForPostgres();

  run(BACKEND_ROOT, 'node', ['scripts/migrate-all.mjs']);
  run(BACKEND_ROOT, 'node', ['scripts/seed-platform.mjs']);

  console.log('\n==> Dev setup complete ==');
  console.log('Start backend:  cd backend && npm run start:dev');
  console.log('Start frontend: cd frontend && npm install && npm run dev');
  console.log('Login: admin@tripsheet.io / admin123');
  console.log('\nIf ports are busy (EADDRINUSE): npm run dev:stop');
  console.log('To wipe local data again: npm run dev:reset -- --yes');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
