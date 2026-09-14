/**
 * Load backend/.env (shared) then service/.env (local overrides).
 * Empty values in the service file do NOT override shared values — fixes
 * notification-service .env with blank SMTP_* blocking backend/.env SMTP.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseEnvFile(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveBackendRoot(serviceRoot) {
  const parent = path.basename(path.dirname(serviceRoot));
  if (parent === 'services') {
    return path.resolve(serviceRoot, '../..');
  }
  return path.resolve(serviceRoot, '..');
}

/**
 * @param {string} serviceRoot - path to service root (parent of src/ or dist/)
 */
export function preloadServiceEnvFromDir(serviceRoot) {
  const backendRoot = resolveBackendRoot(serviceRoot);

  const layers = [
    path.join(backendRoot, '.env'),
    path.join(serviceRoot, '.env'),
  ];

  const merged = {};
  for (const file of layers) {
    if (!existsSync(file)) continue;
    const parsed = parseEnvFile(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (value === '' && merged[key] !== undefined) continue;
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    const current = process.env[key];
    if (current === undefined || current === '') {
      process.env[key] = value;
    }
  }

  if (!process.env.REDIS_URL || process.env.REDIS_URL === '') {
    const host = merged.REDIS_HOST || process.env.REDIS_HOST || 'localhost';
    const port = merged.REDIS_PORT || process.env.REDIS_PORT || '6379';
    process.env.REDIS_URL = `redis://${host}:${port}`;
  }

  if (!process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_KEY === '') {
    process.env.INTERNAL_API_KEY =
      merged.INTERNAL_API_KEY || 'tripsheet-internal-dev';
  }

  // Map consolidated DB URLs when a service only defines DATABASE_URL locally.
  const dbAliases = [
    ['AUTH_DATABASE_URL', 'DATABASE_URL'],
    ['COMPANY_DATABASE_URL', 'DATABASE_URL'],
    ['DRIVER_DATABASE_URL', 'DATABASE_URL'],
    ['FLEET_DATABASE_URL', 'DATABASE_URL'],
    ['MANIFEST_DATABASE_URL', 'DATABASE_URL'],
    ['TRIPSHEET_DATABASE_URL', 'DATABASE_URL'],
    ['ACCOUNTING_DATABASE_URL', 'DATABASE_URL'],
    ['NOTIFICATION_DATABASE_URL', 'DATABASE_URL'],
  ];
  for (const [canonical, local] of dbAliases) {
    if (merged[canonical] && (!process.env[local] || process.env[local] === '')) {
      process.env[local] = merged[canonical];
    }
  }

  return { backendRoot, serviceRoot, loaded: layers.filter(existsSync) };
}

/** @deprecated use preloadServiceEnvFromDir(path.join(__dirname, '..')) from main.ts */
export function preloadServiceEnv(entryFile) {
  const entryDir = path.dirname(fileURLToPath(entryFile));
  return preloadServiceEnvFromDir(path.resolve(entryDir, '..'));
}
