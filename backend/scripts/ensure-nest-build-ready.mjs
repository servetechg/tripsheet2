#!/usr/bin/env node
/**
 * Nest `deleteOutDir` + TS `incremental` can leave dist/ empty while .tsbuildinfo
 * still says "up to date". Remove stale cache when dist/main.js is missing.
 */
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const nestRoots = [
  path.join(backendRoot, 'gateway'),
  ...[
    'auth-service',
    'company-service',
    'driver-service',
    'fleet-service',
    'manifest-service',
    'tripsheet-service',
    'accounting-service',
    'notification-service',
  ].map((name) => path.join(backendRoot, 'services', name)),
];

for (const root of nestRoots) {
  const mainJs = path.join(root, 'dist', 'main.js');
  if (existsSync(mainJs)) continue;
  for (const info of ['tsconfig.tsbuildinfo', 'tsconfig.build.tsbuildinfo']) {
    const p = path.join(root, info);
    if (existsSync(p)) {
      unlinkSync(p);
      console.log(`==> Removed stale ${path.relative(backendRoot, p)}`);
    }
  }
}
