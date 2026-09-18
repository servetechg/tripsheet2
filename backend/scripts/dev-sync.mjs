#!/usr/bin/env node
/**
 * Run after every git pull (from backend/):
 *   npm run dev:sync
 *
 * 1. Builds repo shared/ + backend/shared/tenant-runtime (fixes missing @tripsheet/tenant-runtime exports)
 * 2. Starts Postgres/Redis if needed
 * 3. Applies Prisma migrate deploy on all platform service databases
 * 4. Applies tenant org SQL (018+, MDM, accounting/notification parity) on every active company DB
 *
 * Does not wipe data. Does not npm install every service (use dev:setup on a new machine).
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForPostgres } from './lib/wait-postgres.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
const COMPANY_SERVICE = path.join(BACKEND_ROOT, 'services', 'company-service');

function run(cwd, cmd, args = [], { optional = false } = {}) {
  const label = path.relative(REPO_ROOT, cwd) || '.';
  console.log(`\n$ (${label}) ${cmd} ${args.join(' ')}`);
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

async function main() {
  console.log('\n==> TripSheet dev:sync (post-pull)\n');

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

  console.log('\n==> infrastructure (Postgres + Redis)');
  run(BACKEND_ROOT, 'docker', ['compose', 'up', '-d', 'postgres', 'redis']);
  waitForPostgres();

  console.log('\n==> platform Prisma migrations');
  run(BACKEND_ROOT, 'node', ['scripts/migrate-all.mjs']);

  console.log('\n==> tenant org SQL (all active company databases)');
  if (!existsSync(path.join(COMPANY_SERVICE, 'package.json'))) {
    console.warn('skip tenant migrate — company-service not found');
  } else {
    run(COMPANY_SERVICE, 'npm', ['run', 'schema:migrate-all'], {
      optional: true,
    });
  }

  console.log('\n==> dev:sync complete ==');
  console.log('Start stack:  npm run start:dev');
  console.log('If TS errors persist in watch mode, stop and run start:dev again.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
