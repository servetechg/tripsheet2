#!/usr/bin/env node
/**
 * Minimal platform seed for local dev:
 * - auth: RBAC catalog + super admin (admin@tripsheet.io / admin123)
 * - company: subscription plans (no demo companies or users)
 *
 * Usage (from backend/): npm run seed:platform
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');

function run(cwd, args) {
  const result = spawnSync('npx', args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed in ${cwd}: npx ${args.join(' ')}`);
  }
}

const authDir = path.join(BACKEND_ROOT, 'services', 'auth-service');
const companyDir = path.join(BACKEND_ROOT, 'services', 'company-service');

console.log('\n==> seed platform (super admin + plans, no demo tenants)\n');

run(authDir, ['prisma', 'generate']);
run(authDir, ['ts-node', '--transpile-only', 'prisma/seed.ts']);

run(companyDir, ['prisma', 'generate']);
run(companyDir, ['ts-node', '--transpile-only', 'prisma/seed.ts']);

console.log('\nPlatform seed complete.');
console.log('Login: admin@tripsheet.io / admin123');
