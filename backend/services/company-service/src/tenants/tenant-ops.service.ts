import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../platform/crypto.util';
import { parseAdminUrl } from '../platform/pg-admin.util';
import { pushTenantOpsSchemas } from './schema-sync.util';
import { TenantLocalService } from '../org/tenant-local.service';
import {
  clearTenantErrorFields,
  tenantErrorWriteFields,
  tenantHasActionableIssue,
  buildTenantIssue,
} from './tenant-error.util';

@Injectable()
export class TenantOpsService {
  private readonly logger = new Logger(TenantOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tenantLocal: TenantLocalService,
  ) {}

  /**
   * Per-tenant ops snapshot: registry status + Postgres size / connections.
   */
  async getOpsSummary() {
    const rows = await this.prisma.tenantDatabase.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            status: true,
            active: true,
          },
        },
      },
      orderBy: { dbName: 'asc' },
    });

    const recentErrors = await this.prisma.tenantLifecycleEvent.findMany({
      where: {
        OR: [
          { action: { contains: 'fail' } },
          { action: { contains: 'error' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    let pgStats: Record<
      string,
      { sizeBytes: number; sizePretty: string; connections: number }
    > = {};

    try {
      const admin = parseAdminUrl(this.config);
      const client = new Client({
        host: admin.host,
        port: admin.port,
        user: admin.user,
        password: admin.password,
        database: 'postgres',
        ssl: admin.ssl ? { rejectUnauthorized: false } : undefined,
      });
      await client.connect();
      try {
        const sizes = await client.query<{
          datname: string;
          size_bytes: string;
          size_pretty: string;
        }>(`
          SELECT d.datname,
                 pg_database_size(d.datname)::text AS size_bytes,
                 pg_size_pretty(pg_database_size(d.datname)) AS size_pretty
          FROM pg_database d
          WHERE d.datname LIKE 'fq_tenant_%'
        `);
        const conns = await client.query<{
          datname: string;
          n: string;
        }>(`
          SELECT datname, count(*)::text AS n
          FROM pg_stat_activity
          WHERE datname LIKE 'fq_tenant_%'
          GROUP BY datname
        `);
        const connMap = new Map(conns.rows.map((r) => [r.datname, Number(r.n)]));
        for (const r of sizes.rows) {
          pgStats[r.datname] = {
            sizeBytes: Number(r.size_bytes),
            sizePretty: r.size_pretty,
            connections: connMap.get(r.datname) || 0,
          };
        }
      } finally {
        await client.end().catch(() => undefined);
      }
    } catch (e) {
      this.logger.warn(
        `pg stats unavailable: ${e instanceof Error ? e.message : e}`,
      );
    }

    const tenants = rows.map((r) => {
      const stats = pgStats[r.dbName] || {
        sizeBytes: 0,
        sizePretty: '—',
        connections: 0,
      };
      const issue = buildTenantIssue(r, { includeTechnicalDetail: true });
      return {
        companyId: r.companyId,
        name: r.company.name,
        shortName: r.company.shortName,
        slug: r.company.slug,
        companyStatus: r.company.status,
        companyActive: r.company.active,
        dbName: r.dbName,
        status: r.status,
        routingMode: r.routingMode,
        etlStatus: r.etlStatus,
        schemaVersion: r.schemaVersion,
        writeFreeze: r.writeFreeze,
        issue,
        provisionedAt: r.provisionedAt,
        cutoverAt: r.cutoverAt,
        sizeBytes: stats.sizeBytes,
        sizePretty: stats.sizePretty,
        connections: stats.connections,
      };
    });

    const totals = {
      tenants: tenants.length,
      active: tenants.filter((t) => t.status === 'active').length,
      failed: tenants.filter((t) => t.status === 'failed').length,
      suspended: tenants.filter((t) => t.status === 'suspended').length,
      withErrors: rows.filter((r) => tenantHasActionableIssue(r)).length,
      totalSizeBytes: tenants.reduce((s, t) => s + t.sizeBytes, 0),
      totalConnections: tenants.reduce((s, t) => s + t.connections, 0),
    };

    return {
      generatedAt: new Date().toISOString(),
      totals,
      tenants,
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        companyId: e.companyId,
        action: e.action,
        actorName: e.actorName,
        detail: e.detail,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Apply org SQL + Prisma ops push for one active tenant (idempotent).
   */
  async ensureCompanySchemas(companyId: string) {
    const row = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
    });
    if (!row || row.status !== 'active') {
      throw new Error(`Tenant ${companyId} is not active`);
    }

    await this.tenantLocal.ensureAllTenantOrgSchemas(companyId);
    try {
      await this.tenantLocal.getSecurityPolicy(companyId);
    } catch (e) {
      this.logger.warn(
        `getSecurityPolicy skip ${companyId}: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }

    let pushOk: boolean | 'skipped' = 'skipped';
    let pushError: string | undefined;
    if (row.connectionCiphertext) {
      try {
        const url = decryptSecret(row.connectionCiphertext);
        const pushed = await pushTenantOpsSchemas(url, { quiet: true });
        pushOk = pushed ? true : 'skipped';
        if (pushed) {
          await this.prisma.tenantDatabase.update({
            where: { id: row.id },
            data: { schemaVersion: '6', ...clearTenantErrorFields() },
          });
        } else if (
          row.lastErrorCode === 'TENANT_SCHEMA_SYNC_SKIPPED' ||
          /no sibling prisma projects found/i.test(row.lastError || '')
        ) {
          await this.prisma.tenantDatabase.update({
            where: { id: row.id },
            data: clearTenantErrorFields(),
          });
        }
      } catch (pushErr) {
        const msg =
          pushErr instanceof Error ? pushErr.message : String(pushErr);
        this.logger.warn(`ops push skip/fail ${row.dbName}: ${msg}`);
        pushOk = false;
        pushError = msg.slice(0, 500);
        await this.prisma.tenantDatabase
          .update({
            where: { id: row.id },
            data: tenantErrorWriteFields(msg),
          })
          .catch(() => undefined);
      }
    }

    return { ok: true, companyId, orgOk: true, pushOk, pushError };
  }

  /**
   * Phase 6 migrate-all: apply org SQL + non-destructive Prisma push (when sibling
   * service trees exist on disk). Safe for CI after deploy.
   */
  async schemaMigrateAll(actorName = 'ci') {
    const rows = await this.prisma.tenantDatabase.findMany({
      where: { status: 'active' },
      orderBy: { dbName: 'asc' },
    });

    const results: Array<{
      companyId: string;
      dbName: string;
      orgOk: boolean;
      pushOk: boolean | 'skipped';
      error?: string;
    }> = [];

    for (const row of rows) {
      const entry: (typeof results)[number] = {
        companyId: row.companyId,
        dbName: row.dbName,
        orgOk: false,
        pushOk: 'skipped',
      };
      try {
        await this.tenantLocal.ensureAllTenantOrgSchemas(row.companyId);
        await this.tenantLocal.getSecurityPolicy(row.companyId);
        entry.orgOk = true;

        if (row.connectionCiphertext) {
          try {
            const url = decryptSecret(row.connectionCiphertext);
            const pushed = await pushTenantOpsSchemas(url, { quiet: true });
            entry.pushOk = pushed ? true : 'skipped';
            if (pushed) {
              await this.prisma.tenantDatabase.update({
                where: { id: row.id },
                data: { schemaVersion: '6', ...clearTenantErrorFields() },
              });
            } else if (
              row.lastErrorCode === 'TENANT_SCHEMA_SYNC_SKIPPED' ||
              /no sibling prisma projects found/i.test(row.lastError || '')
            ) {
              await this.prisma.tenantDatabase.update({
                where: { id: row.id },
                data: clearTenantErrorFields(),
              });
            }
          } catch (pushErr) {
            const msg =
              pushErr instanceof Error ? pushErr.message : String(pushErr);
            this.logger.warn(`ops push skip/fail ${row.dbName}: ${msg}`);
            entry.pushOk = false;
            entry.error = msg.slice(0, 500);
            await this.prisma.tenantDatabase
              .update({
                where: { id: row.id },
                data: tenantErrorWriteFields(msg),
              })
              .catch(() => undefined);
          }
        }

        await this.prisma.tenantLifecycleEvent.create({
          data: {
            companyId: row.companyId,
            action: 'tenant.schema_migrate',
            actorName,
            detail: {
              orgOk: entry.orgOk,
              pushOk: entry.pushOk,
              phase: 6,
            },
          },
        });
      } catch (e) {
        entry.error = e instanceof Error ? e.message : String(e);
        await this.prisma.tenantDatabase
          .update({
            where: { id: row.id },
            data: tenantErrorWriteFields(entry.error),
          })
          .catch(() => undefined);
      }
      results.push(entry);
    }

    return {
      migrated: results.length,
      ok: results.filter((r) => r.orgOk && r.pushOk !== false).length,
      results,
    };
  }
}
