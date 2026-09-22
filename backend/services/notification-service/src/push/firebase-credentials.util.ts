import { existsSync, readdirSync } from 'fs';
import { isAbsolute, join } from 'path';

export type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

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
        return 'Set FIREBASE_SERVICE_ACCOUNT_JSON_B64 in server secrets (production) or save backend/secrets/firebase-admin.json (local dev). See backend/secrets/SETUP.txt';
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function parseJson(raw: string, label: string): ServiceAccountJson {
  try {
    return JSON.parse(raw) as ServiceAccountJson;
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

/**
 * Load Firebase service account from env (preferred in Docker/production).
 * Order: FIREBASE_SERVICE_ACCOUNT_JSON_B64 → FIREBASE_SERVICE_ACCOUNT_JSON → file path.
 */
export function loadServiceAccountFromConfig(options: {
  jsonB64?: string;
  jsonRaw?: string;
  credentialsPath?: string;
  serviceRoot: string;
  readFile: (path: string) => string;
}): { account: ServiceAccountJson; source: string } | null {
  const b64 = options.jsonB64?.trim();
  if (b64) {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return {
      account: parseJson(decoded, 'FIREBASE_SERVICE_ACCOUNT_JSON_B64'),
      source: 'FIREBASE_SERVICE_ACCOUNT_JSON_B64',
    };
  }

  const jsonRaw = options.jsonRaw?.trim();
  if (jsonRaw) {
    return {
      account: parseJson(jsonRaw, 'FIREBASE_SERVICE_ACCOUNT_JSON'),
      source: 'FIREBASE_SERVICE_ACCOUNT_JSON',
    };
  }

  const { path: resolvedPath } = resolveFirebaseCredentialsPath(
    options.credentialsPath,
    options.serviceRoot,
  );
  if (!existsSync(resolvedPath)) {
    return null;
  }

  return {
    account: parseJson(
      options.readFile(resolvedPath),
      `Service account file ${resolvedPath}`,
    ),
    source: resolvedPath,
  };
}
