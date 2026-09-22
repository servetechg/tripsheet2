/**
 * Merge backend/.env then frontend/.env (frontend wins). Used by Vite and SW generator.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');
const backendRoot = join(frontendRoot, '..', 'backend');

export function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val === '' && out[key] !== undefined) continue;
    out[key] = val;
  }
  return out;
}

function loadFile(path) {
  if (!existsSync(path)) return {};
  return parseEnvFile(readFileSync(path, 'utf8'));
}

/** @param {{ prefix?: string }} [opts] */
export function loadMonorepoEnv(opts = {}) {
  const prefix = opts.prefix;
  const layers = [
    join(backendRoot, '.env'),
    join(frontendRoot, '.env'),
  ];
  const merged = {};
  for (const file of layers) {
    Object.assign(merged, loadFile(file));
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || value === '') continue;
    merged[key] = value;
  }
  if (!prefix) return merged;
  const filtered = {};
  for (const [key, value] of Object.entries(merged)) {
    if (key.startsWith(prefix)) filtered[key] = value;
  }
  return filtered;
}

export function resolveEnvPath(name, merged) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  return merged[name]?.trim() || '';
}

export { backendRoot, frontendRoot };
