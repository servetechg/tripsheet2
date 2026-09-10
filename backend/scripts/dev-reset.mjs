#!/usr/bin/env node
/**
 * Wipe local Postgres + Redis volumes and rebuild a clean dev database.
 *
 * Usage (from backend/):
 *   npm run dev:reset              # interactive confirm
 *   npm run dev:reset -- --yes     # no prompt
 *   npm run dev:reset -- --yes --stop   # also free dev ports first (Windows)
 *
 * Result: empty service DBs, migrations applied, super admin + plans only.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { waitForPostgres } from './lib/wait-postgres.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const autoYes = args.has('--yes') || process.env.DEV_RESET_YES === '1';
const stopFirst = args.has('--stop');

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: BACKEND_ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
    ...opts,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Failed: ${cmd} ${cmdArgs.join(' ')}`);
  }
}

async function confirm() {
  if (autoYes) return;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) => {
    rl.question(
      'This deletes ALL local TripSheet Postgres/Redis data. Continue? [y/N] ',
      resolve,
    );
  });
  rl.close();
  if (!/^y(es)?$/i.test(String(answer).trim())) {
    console.log('Aborted.');
    process.exit(0);
  }
}

async function main() {
  console.log('\n==> TripSheet dev reset (local data only)\n');

  await confirm();

  if (stopFirst && process.platform === 'win32') {
    console.log('\n-- stopping dev listeners --');
    run(
      'powershell',
      ['-NoProfile', '-File', path.join(BACKEND_ROOT, 'scripts', 'dev-stop.ps1')],
    );
  } else if (stopFirst) {
    console.log('Tip: on Windows add --stop to free ports 3000-3008 and 5173.');
  }

  console.log('\n-- removing docker volumes --');
  run('docker', ['compose', 'down', '-v']);

  console.log('\n-- starting postgres + redis --');
  run('docker', ['compose', 'up', '-d']);
  await waitForPostgres();

  console.log('\n-- applying migrations --');
  run('node', [path.join(BACKEND_ROOT, 'scripts', 'migrate-all.mjs')]);

  console.log('\n-- seeding platform --');
  run('node', [path.join(BACKEND_ROOT, 'scripts', 'seed-platform.mjs')]);

  console.log('\n==> Dev reset complete ==');
  console.log('Next:');
  console.log('  cd backend && npm run start:dev');
  console.log('  cd frontend && npm run dev');
  console.log('Login: admin@tripsheet.io / admin123');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
