import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../platform/crypto.util';
import { ETL_TABLES, ETL_TABLES_DELETE_ORDER, EtlTable } from './etl.catalog';
import { syncTenantOpsSchemas } from './schema-sync.util';
import { ProvisioningService } from './provisioning.service';

export type TableCopyResult = {
  schema: string;
  table: string;
  sharedDb: string;
  sourceCount: number;
  destCount: number;
  copied: number;
  checksumSource: string;
  checksumDest: string;
  match: boolean;
};

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly provisioning: ProvisioningService,
  ) {}

  private sharedUrl(dbName: string): string {
    const specific = this.config.get<string>(
      `SHARED_${dbName.toUpperCase()}_URL`,
    );
    if (specific) return specific;
    const base =
      this.config.get<string>('SHARED_DB_BASE') ||
      this.config.get<string>('TENANT_PROVISION_URL') ||
      this.config.get<string>('DATABASE_URL') ||
      '';
    if (!base) {
      throw new BadRequestException(
        'SHARED_DB_BASE or DATABASE_URL required for ETL',
      );
    }
    const u = new URL(base);
    u.pathname = `/${dbName}`;
    // strip schema query from company_db urls
    u.searchParams.delete('schema');
    return u.toString();
  }

  private async requireTenant(companyId: string) {
    const row = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
      include: { company: true },
    });
    if (!row) throw new NotFoundException(`Tenant ${companyId} not found`);
    return row;
  }

  /**
   * Full Phase 4 migrate: ensure provisioned → sync schemas → copy → verify.
   * Does not flip routingMode (call cutover separately).
   */
  async migrateCompany(
    companyId: string,
    opts?: { actorName?: string; skipSync?: boolean },
  ) {
    let row = await this.requireTenant(companyId);

    if (row.status !== 'active' || !row.connectionCiphertext) {
      this.logger.log(`Provisioning ${companyId} before ETL`);
      await this.provisioning.provisionCompany(companyId, {
        force: true,
        actorName: opts?.actorName || 'etl',
      });
      row = await this.requireTenant(companyId);
    }

    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: { etlStatus: 'syncing', lastError: '' },
    });
    await this.lifecycle(companyId, 'tenant.etl.started', opts?.actorName, {
      dbName: row.dbName,
    });

    let tenantUrl: string;
    try {
      tenantUrl = decryptSecret(row.connectionCiphertext);
    } catch {
      throw new BadRequestException('Cannot decrypt tenant connection');
    }

    try {
      if (!opts?.skipSync) {
        await syncTenantOpsSchemas(tenantUrl, { quiet: false });
        await this.prisma.tenantDatabase.update({
          where: { companyId },
          data: { schemaVersion: '3', etlStatus: 'copying' },
        });
      } else {
        await this.prisma.tenantDatabase.update({
          where: { companyId },
          data: { etlStatus: 'copying' },
        });
      }

      const tables: TableCopyResult[] = [];
      for (const spec of ETL_TABLES) {
        try {
          tables.push(await this.copyTable(companyId, tenantUrl, spec));
        } catch (e: any) {
          const msg = e?.message || String(e);
          this.logger.error(
            `Copy failed ${spec.sharedDb}.${spec.table}: ${msg}`,
          );
          throw new Error(`${spec.schema}.${spec.table}: ${msg}`);
        }
      }

      await this.prisma.tenantDatabase.update({
        where: { companyId },
        data: { etlStatus: 'verifying' },
      });

      const mismatches = tables.filter((t) => !t.match);
      const report = {
        phase: 4,
        migratedAt: new Date().toISOString(),
        tables,
        ok: mismatches.length === 0,
        mismatchCount: mismatches.length,
      };

      if (mismatches.length) {
        await this.prisma.tenantDatabase.update({
          where: { companyId },
          data: {
            etlStatus: 'failed',
            etlReport: report as object,
            lastError: `Count/checksum mismatch on ${mismatches.length} table(s)`,
          },
        });
        await this.lifecycle(companyId, 'tenant.etl.failed', opts?.actorName, {
          mismatches: mismatches.map((m) => `${m.schema}.${m.table}`),
        });
        throw new BadRequestException({
          message: 'ETL verification failed',
          mismatches,
        });
      }

      const verified = await this.prisma.tenantDatabase.update({
        where: { companyId },
        data: {
          etlStatus: 'verified',
          etlReport: report as object,
          etlVerifiedAt: new Date(),
          lastError: '',
        },
      });

      await this.lifecycle(companyId, 'tenant.etl.verified', opts?.actorName, {
        tables: tables.length,
        rows: tables.reduce((s, t) => s + t.copied, 0),
      });

      return {
        companyId,
        dbName: verified.dbName,
        etlStatus: verified.etlStatus,
        report,
      };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      const msg = e?.message || String(e);
      await this.prisma.tenantDatabase.update({
        where: { companyId },
        data: { etlStatus: 'failed', lastError: msg.slice(0, 2000) },
      });
      await this.lifecycle(companyId, 'tenant.etl.failed', opts?.actorName, {
        error: msg.slice(0, 500),
      });
      throw new BadRequestException(`ETL failed: ${msg}`);
    }
  }

  async verifyCompany(companyId: string) {
    const row = await this.requireTenant(companyId);
    if (!row.connectionCiphertext) {
      throw new BadRequestException('Tenant not provisioned');
    }
    const tenantUrl = decryptSecret(row.connectionCiphertext);
    const tables: TableCopyResult[] = [];
    for (const spec of ETL_TABLES) {
      tables.push(await this.compareTable(companyId, tenantUrl, spec));
    }
    const mismatches = tables.filter((t) => !t.match);
    const report = {
      phase: 4,
      verifiedAt: new Date().toISOString(),
      tables,
      ok: mismatches.length === 0,
      mismatchCount: mismatches.length,
    };
    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        etlStatus: mismatches.length ? 'failed' : 'verified',
        etlReport: report as object,
        etlVerifiedAt: mismatches.length ? row.etlVerifiedAt : new Date(),
        lastError: mismatches.length
          ? `Verify mismatch on ${mismatches.length} table(s)`
          : '',
      },
    });
    return { companyId, ok: mismatches.length === 0, report };
  }

  /** Freeze shared writes for this company (pre-cutover maintenance). */
  async setWriteFreeze(
    companyId: string,
    freeze: boolean,
    actorName = 'superadmin',
  ) {
    await this.requireTenant(companyId);
    const updated = await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: { writeFreeze: freeze },
    });
    await this.lifecycle(companyId, 'tenant.write_freeze', actorName, {
      writeFreeze: freeze,
    });
    return {
      companyId,
      writeFreeze: updated.writeFreeze,
      routingMode: updated.routingMode,
      etlStatus: updated.etlStatus,
    };
  }

  /**
   * Cut over live traffic to tenant DB.
   * Requires etlStatus=verified (or force). Enables writeFreeze on shared path.
   */
  async cutoverCompany(
    companyId: string,
    opts?: { force?: boolean; actorName?: string },
  ) {
    const row = await this.requireTenant(companyId);
    if (row.status !== 'active') {
      throw new BadRequestException('Tenant DB must be active');
    }
    if (row.etlStatus !== 'verified' && row.etlStatus !== 'cutover' && !opts?.force) {
      throw new BadRequestException(
        `ETL must be verified before cutover (status=${row.etlStatus}). Pass force=true to override.`,
      );
    }

    const updated = await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        routingMode: 'tenant',
        writeFreeze: true,
        etlStatus: 'cutover',
        cutoverAt: new Date(),
        lastError: '',
      },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'active', active: true },
    });
    await this.lifecycle(companyId, 'tenant.cutover', opts?.actorName, {
      routingMode: 'tenant',
      writeFreeze: true,
    });

    return {
      companyId,
      dbName: updated.dbName,
      routingMode: updated.routingMode,
      etlStatus: updated.etlStatus,
      cutoverAt: updated.cutoverAt,
      writeFreeze: updated.writeFreeze,
    };
  }

  /**
   * Delete company rows from shared microservice DBs (post-cutover archive).
   * Keeps auth_db users. Irreversible for shared copies.
   */
  async archiveSharedData(
    companyId: string,
    opts?: { actorName?: string; force?: boolean },
  ) {
    const row = await this.requireTenant(companyId);
    if (row.routingMode !== 'tenant' && !opts?.force) {
      throw new BadRequestException(
        'Archive only after cutover (routingMode=tenant)',
      );
    }
    if (row.etlStatus !== 'cutover' && row.etlStatus !== 'archived' && !opts?.force) {
      throw new BadRequestException(
        'Archive only after successful cutover',
      );
    }

    const deleted: { sharedDb: string; table: string; count: number }[] = [];
    for (const spec of ETL_TABLES_DELETE_ORDER) {
      const src = new Client({
        connectionString: this.sharedUrl(spec.sharedDb),
      });
      await src.connect();
      try {
        const col = spec.companyColumn || 'companyId';
        const exists = await this.tableExists(src, 'public', spec.table);
        if (!exists) continue;
        const res = await src.query(
          `DELETE FROM ${this.q('public', spec.table)} WHERE ${this.qi(col)} = $1`,
          [companyId],
        );
        deleted.push({
          sharedDb: spec.sharedDb,
          table: spec.table,
          count: res.rowCount || 0,
        });
      } finally {
        await src.end().catch(() => undefined);
      }
    }

    const updated = await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        etlStatus: 'archived',
        archivedAt: new Date(),
        etlReport: {
          ...((row.etlReport as object) || {}),
          archive: { deletedAt: new Date().toISOString(), deleted },
        } as object,
      },
    });

    await this.lifecycle(companyId, 'tenant.archive', opts?.actorName, {
      deleted,
    });

    return {
      companyId,
      etlStatus: updated.etlStatus,
      archivedAt: updated.archivedAt,
      deleted,
    };
  }

  async migrateAll(actorName = 'cli') {
    const rows = await this.prisma.tenantDatabase.findMany({
      where: { status: 'active' },
      include: { company: { select: { shortName: true, slug: true } } },
    });
    const results: unknown[] = [];
    for (const row of rows) {
      try {
        results.push(await this.migrateCompany(row.companyId, { actorName }));
      } catch (e: any) {
        results.push({
          companyId: row.companyId,
          error: e?.message || String(e),
        });
      }
    }
    return { count: rows.length, results };
  }

  async cutoverAllVerified(actorName = 'cli') {
    const rows = await this.prisma.tenantDatabase.findMany({
      where: { etlStatus: 'verified', status: 'active' },
    });
    const results: unknown[] = [];
    for (const row of rows) {
      try {
        results.push(
          await this.cutoverCompany(row.companyId, { actorName }),
        );
      } catch (e: any) {
        results.push({
          companyId: row.companyId,
          error: e?.message || String(e),
        });
      }
    }
    return { count: rows.length, results };
  }

  private async copyTable(
    companyId: string,
    tenantUrl: string,
    spec: EtlTable,
  ): Promise<TableCopyResult> {
    const col = spec.companyColumn || 'companyId';
    const src = new Client({ connectionString: this.sharedUrl(spec.sharedDb) });
    const dest = new Client({ connectionString: tenantUrl });
    await src.connect();
    await dest.connect();
    try {
      const srcExists = await this.tableExists(src, 'public', spec.table);
      if (!srcExists) {
        return this.emptyResult(spec, 0, 0, '', '', true);
      }
      const destExists = await this.tableExists(dest, spec.schema, spec.table);
      if (!destExists) {
        throw new Error(
          `Destination ${spec.schema}.${spec.table} missing — run schema sync`,
        );
      }

      const { rows } = await src.query(
        `SELECT * FROM ${this.q('public', spec.table)} WHERE ${this.qi(col)} = $1`,
        [companyId],
      );
      const sourceCount = rows.length;
      const checksumSource = this.checksumIds(rows);

      // Clear prior ETL attempt for this company in dest
      await dest.query(
        `DELETE FROM ${this.q(spec.schema, spec.table)} WHERE ${this.qi(col)} = $1`,
        [companyId],
      );

      let copied = 0;
      if (rows.length) {
        const columns = Object.keys(rows[0]);
        const colList = columns.map((c) => this.qi(c)).join(', ');
        const updateCols = columns.filter((c) => c !== 'id');
        const conflict = columns.includes('id')
          ? updateCols.length
            ? `ON CONFLICT (${this.qi('id')}) DO UPDATE SET ${updateCols
                .map((c) => `${this.qi(c)} = EXCLUDED.${this.qi(c)}`)
                .join(', ')}`
            : `ON CONFLICT (${this.qi('id')}) DO NOTHING`
          : '';

        const batchSize = 50;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          for (const row of batch) {
            const values = columns.map((c) => {
              const v = row[c];
              if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
                return JSON.stringify(v);
              }
              return v;
            });
            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
            await dest.query(
              `INSERT INTO ${this.q(spec.schema, spec.table)} (${colList})
               VALUES (${placeholders})
               ${conflict}`,
              values,
            );
            copied += 1;
          }
        }
      }

      const destCountRes = await dest.query(
        `SELECT COUNT(*)::int AS c FROM ${this.q(spec.schema, spec.table)} WHERE ${this.qi(col)} = $1`,
        [companyId],
      );
      const destCount = destCountRes.rows[0]?.c ?? 0;
      const destRows = await dest.query(
        `SELECT ${this.qi('id')} FROM ${this.q(spec.schema, spec.table)} WHERE ${this.qi(col)} = $1`,
        [companyId],
      );
      const checksumDest = this.checksumIds(destRows.rows);
      const match = sourceCount === destCount && checksumSource === checksumDest;

      this.logger.log(
        `${spec.sharedDb}.${spec.table} → ${spec.schema}.${spec.table}: ${copied} rows match=${match}`,
      );

      return {
        schema: spec.schema,
        table: spec.table,
        sharedDb: spec.sharedDb,
        sourceCount,
        destCount,
        copied,
        checksumSource,
        checksumDest,
        match,
      };
    } finally {
      await src.end().catch(() => undefined);
      await dest.end().catch(() => undefined);
    }
  }

  private async compareTable(
    companyId: string,
    tenantUrl: string,
    spec: EtlTable,
  ): Promise<TableCopyResult> {
    const col = spec.companyColumn || 'companyId';
    const src = new Client({ connectionString: this.sharedUrl(spec.sharedDb) });
    const dest = new Client({ connectionString: tenantUrl });
    await src.connect();
    await dest.connect();
    try {
      const srcExists = await this.tableExists(src, 'public', spec.table);
      const destExists = await this.tableExists(dest, spec.schema, spec.table);
      if (!srcExists && !destExists) {
        return this.emptyResult(spec, 0, 0, '', '', true);
      }
      const sourceRows = srcExists
        ? (
            await src.query(
              `SELECT ${this.qi('id')} FROM ${this.q('public', spec.table)} WHERE ${this.qi(col)} = $1`,
              [companyId],
            )
          ).rows
        : [];
      const destRows = destExists
        ? (
            await dest.query(
              `SELECT ${this.qi('id')} FROM ${this.q(spec.schema, spec.table)} WHERE ${this.qi(col)} = $1`,
              [companyId],
            )
          ).rows
        : [];
      const checksumSource = this.checksumIds(sourceRows);
      const checksumDest = this.checksumIds(destRows);
      const sourceCount = sourceRows.length;
      const destCount = destRows.length;
      return {
        schema: spec.schema,
        table: spec.table,
        sharedDb: spec.sharedDb,
        sourceCount,
        destCount,
        copied: destCount,
        checksumSource,
        checksumDest,
        match: sourceCount === destCount && checksumSource === checksumDest,
      };
    } finally {
      await src.end().catch(() => undefined);
      await dest.end().catch(() => undefined);
    }
  }

  private emptyResult(
    spec: EtlTable,
    sourceCount: number,
    destCount: number,
    checksumSource: string,
    checksumDest: string,
    match: boolean,
  ): TableCopyResult {
    return {
      schema: spec.schema,
      table: spec.table,
      sharedDb: spec.sharedDb,
      sourceCount,
      destCount,
      copied: 0,
      checksumSource,
      checksumDest,
      match,
    };
  }

  private checksumIds(rows: { id?: string }[]): string {
    const ids = rows
      .map((r) => r.id)
      .filter(Boolean)
      .sort() as string[];
    return createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 16);
  }

  private async tableExists(
    client: Client,
    schema: string,
    table: string,
  ): Promise<boolean> {
    const res = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, table],
    );
    return (res.rowCount || 0) > 0;
  }

  private qi(ident: string) {
    if (!/^[a-zA-Z0-9_]+$/.test(ident)) {
      throw new Error(`Invalid identifier ${ident}`);
    }
    return `"${ident}"`;
  }

  private q(schema: string, table: string) {
    return `${this.qi(schema)}.${this.qi(table)}`;
  }

  private async lifecycle(
    companyId: string,
    action: string,
    actorName?: string,
    detail?: object,
  ) {
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action,
        actorName: actorName || 'system',
        detail: { ...detail, phase: 4 },
      },
    });
  }
}
