import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { quoteIdent } from '../platform/pg-admin.util';

const SCHEMA_DIRS: { schema: string; prismaDir: string }[] = [
  { schema: 'driver', prismaDir: join(__dirname, '../../../driver-service') },
  { schema: 'fleet', prismaDir: join(__dirname, '../../../fleet-service') },
  { schema: 'manifest', prismaDir: join(__dirname, '../../../manifest-service') },
  {
    schema: 'tripsheet',
    prismaDir: join(__dirname, '../../../tripsheet-service'),
  },
  {
    schema: 'accounting',
    prismaDir: join(__dirname, '../../../accounting-service'),
  },
  {
    schema: 'notification',
    prismaDir: join(__dirname, '../../../notification-service'),
  },
];

export function withSchema(connectionUrl: string, schema: string): string {
  const u = new URL(connectionUrl);
  u.searchParams.set('schema', schema);
  return u.toString();
}

function prismaCli(prismaDir: string): string {
  const p = join(prismaDir, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(p)) {
    throw new Error(`Prisma CLI not found under ${prismaDir}`);
  }
  return p;
}

function resolveSchemaDirs(): { schema: string; prismaDir: string }[] {
  return SCHEMA_DIRS.filter(({ prismaDir }) => existsSync(prismaDir));
}

function prismaDbPush(
  prismaDir: string,
  url: string,
  extraArgs: string[],
  quiet?: boolean,
) {
  try {
    execFileSync(
      process.execPath,
      [prismaCli(prismaDir), 'db', 'push', '--skip-generate', ...extraArgs],
      {
        cwd: prismaDir,
        env: { ...process.env, DATABASE_URL: url },
        stdio: quiet ? 'pipe' : 'inherit',
      },
    );
  } catch (e) {
    if (quiet && e instanceof Error && 'stderr' in e) {
      const stderr = String((e as NodeJS.ErrnoException & { stderr?: Buffer }).stderr || '');
      throw new Error(stderr || e.message);
    }
    throw e;
  }
}

async function schemaHasRows(admin: Client, schema: string): Promise<boolean> {
  const r = await admin.query<{ n: string }>(
    `SELECT COALESCE(SUM(n_live_tup), 0)::text AS n
     FROM pg_stat_user_tables
     WHERE schemaname = $1`,
    [schema],
  );
  return Number(r.rows[0]?.n || 0) > 0;
}

const SCHEMA_PROBE_TABLE: Record<string, string> = {
  driver: 'Driver',
  fleet: 'Load',
  manifest: 'EManifest',
  tripsheet: 'TripSheet',
  accounting: 'LedgerAccount',
  notification: 'NotificationLog',
};

async function resetEmptyOpsSchema(
  admin: Client,
  schema: string,
): Promise<boolean> {
  const probe = SCHEMA_PROBE_TABLE[schema];
  if (!probe) return false;
  try {
    const r = await admin.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ${quoteIdent(schema)}.${quoteIdent(probe)}`,
    );
    if (Number(r.rows[0]?.n || 0) !== 0) {
      return false;
    }
  } catch {
    return false;
  }
  await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
  await admin.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
  return true;
}

/**
 * Ensure ops Prisma schemas exist in the tenant DB.
 * Resets each domain schema (destructive for prior tenant ops rows — safe before ETL).
 */
export async function syncTenantOpsSchemas(
  tenantUrl: string,
  opts?: { quiet?: boolean },
): Promise<void> {
  const dirs = resolveSchemaDirs();
  if (!dirs.length) {
    throw new Error(
      'No sibling Prisma projects found (driver-service, fleet-service, …)',
    );
  }
  const admin = new Client({ connectionString: tenantUrl });
  await admin.connect();
  try {
    for (const { schema, prismaDir } of dirs) {
      if (!opts?.quiet) {
        // eslint-disable-next-line no-console
        console.log(`  sync schema ${schema}`);
      }
      await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
      await admin.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
      prismaDbPush(
        prismaDir,
        withSchema(tenantUrl, schema),
        ['--accept-data-loss'],
        opts?.quiet,
      );
    }
  } finally {
    await admin.end().catch(() => undefined);
  }
}

/**
 * Non-destructive Prisma db push for each domain schema (Phase 6 CI migrate-all).
 * Returns false when sibling service trees are not on disk (e.g. slim container).
 */
export async function pushTenantOpsSchemas(
  tenantUrl: string,
  opts?: { quiet?: boolean },
): Promise<boolean> {
  const dirs = resolveSchemaDirs();
  if (!dirs.length) {
    return false;
  }
  const admin = new Client({ connectionString: tenantUrl });
  await admin.connect();
  try {
    for (const { schema, prismaDir } of dirs) {
      if (!opts?.quiet) {
        // eslint-disable-next-line no-console
        console.log(`  push schema ${schema}`);
      }
      await admin.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
      const reset = await resetEmptyOpsSchema(admin, schema);
      try {
        prismaDbPush(
          prismaDir,
          withSchema(tenantUrl, schema),
          reset ? ['--accept-data-loss'] : [],
          opts?.quiet,
        );
      } catch (firstErr) {
        if (await schemaHasRows(admin, schema)) {
          throw firstErr;
        }
        await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
        await admin.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
        prismaDbPush(
          prismaDir,
          withSchema(tenantUrl, schema),
          ['--accept-data-loss'],
          opts?.quiet,
        );
      }
    }
  } finally {
    await admin.end().catch(() => undefined);
  }
  return true;
}
