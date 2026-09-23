#!/usr/bin/env node
/** Build shared/ if dist is missing — required by fleet and other services. */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sharedDir = path.join(repoRoot, 'shared');
const distIndex = path.join(sharedDir, 'dist', 'index.js');

if (existsSync(distIndex)) {
  process.exit(0);
}

console.log('==> Building @tripsheet/shared (dist missing)...');
const install = spawnSync('npm', ['install'], {
  cwd: sharedDir,
  stdio: 'inherit',
  shell: true,
});
if ((install.status ?? 1) !== 0) process.exit(install.status ?? 1);

const build = spawnSync('npm', ['run', 'build'], {
  cwd: sharedDir,
  stdio: 'inherit',
  shell: true,
});
process.exit(build.status ?? 1);
