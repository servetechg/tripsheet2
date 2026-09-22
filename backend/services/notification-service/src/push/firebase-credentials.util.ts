import { existsSync, readdirSync } from 'fs';
import { isAbsolute, join } from 'path';

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = p.replace(/\\/g, '/').toLowerCase();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(p);
  }
  return out;
}

/** Likely monorepo backend/ roots from service cwd. */
function backendRootCandidates(serviceRoot: string): string[] {
  const cwd = process.cwd();
  return uniquePaths([
    join(serviceRoot, '..', '..'),
    join(cwd, '..', '..'),
    join(cwd, '..'),
    cwd,
    serviceRoot,
    join(serviceRoot, '..'),
  ]);
}

/** Resolve service account path (absolute, relative, or backend/secrets/firebase-admin.json). */
export function resolveFirebaseCredentialsPath(
  configuredPath: string | undefined,
  serviceRoot: string,
): { path: string; tried: string[] } {
  const raw = configuredPath?.trim();
  const candidates: string[] = [];

  if (raw) {
    if (isAbsolute(raw)) {
      candidates.push(raw);
    } else {
      for (const root of backendRootCandidates(serviceRoot)) {
        candidates.push(join(root, raw));
      }
      candidates.push(join(process.cwd(), raw));
      candidates.push(join(serviceRoot, raw));
    }
  }

  for (const root of backendRootCandidates(serviceRoot)) {
    candidates.push(join(root, 'secrets', 'firebase-admin.json'));
  }
  candidates.unshift(join(process.cwd(), 'secrets', 'firebase-admin.json'));

  const tried = uniquePaths(candidates);

  for (const p of tried) {
    if (existsSync(p)) {
      return { path: p, tried };
    }
  }

  const defaultPath = join(
    join(serviceRoot, '..', '..'),
    'secrets',
    'firebase-admin.json',
  );

  return {
    path: raw && isAbsolute(raw) ? raw : defaultPath,
    tried,
  };
}

/** Hint when secrets dir has downloads but not firebase-admin.json */
export function secretsDirectoryHint(serviceRoot: string): string | undefined {
  for (const root of backendRootCandidates(serviceRoot)) {
    const dir = join(root, 'secrets');
    if (!existsSync(dir)) continue;
    try {
      const names = readdirSync(dir);
      const jsonFiles = names.filter(
        (n) => n.endsWith('.json') && n !== 'firebase-admin.json.example',
      );
      if (jsonFiles.length > 0 && !names.includes('firebase-admin.json')) {
        return `Found ${jsonFiles.join(', ')} in secrets/ — rename or copy to firebase-admin.json`;
      }
      if (!names.includes('firebase-admin.json')) {
        return 'Download key from Firebase Console and save as backend/secrets/firebase-admin.json (see SETUP.txt)';
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}
