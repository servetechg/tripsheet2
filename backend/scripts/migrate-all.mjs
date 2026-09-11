#!/usr/bin/env node
/**
 * Apply Prisma migrations for every microservice (Windows / macOS / Linux).
 *
 * Usage (from backend/):
 *   npm run migrate:all          # prisma generate + migrate deploy
 *   npm run migrate:status       # prisma migrate status
 *
 * Requires Postgres up (npm run infra:up) and each service .env with DATABASE_URL.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const SERVICES = [
  'auth-service',
  'company-service',
  'driver-service',
  'fleet-service',
  'manifest-service',
  'tripsheet-service',
  'accounting-service',
  'notification-service',
];

const MODE = process.argv.includes('--status') ? 'status' : 'deploy';

function runPrisma(cwd, args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  return result.status ?? 1;
}

const failed = [];

for (const name of SERVICES) {
  const cwd = path.join(BACKEND_ROOT, 'services', name);
  const schema = path.join(cwd, 'prisma', 'schema.prisma');
  console.log(`\n======== ${name} ========`);
  if (!existsSync(schema)) {
    console.error(`Skip: no prisma/schema.prisma in ${cwd}`);
    failed.push(name);
    continue;
  }

  if (MODE === 'status') {
    const code = runPrisma(cwd, ['migrate', 'status']);
    if (code !== 0) failed.push(name);
    continue;
  }

  const gen = runPrisma(cwd, ['generate']);
  if (gen !== 0) {
    failed.push(name);
    continue;
  }
  const deploy = runPrisma(cwd, ['migrate', 'deploy']);
  if (deploy !== 0) failed.push(name);
}

console.log('\n======== summary ========');
if (failed.length) {
  console.error(`Failed (${MODE}): ${failed.join(', ')}`);
  process.exit(1);
}
console.log(
  MODE === 'status'
    ? 'All services reported migrate status (exit 0).'
    : 'All service databases are up to date.',
);
