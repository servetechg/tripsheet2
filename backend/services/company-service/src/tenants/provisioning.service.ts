import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, tenantDbName } from '../platform/crypto.util';
import {
  buildTenantUrl,
  parseAdminUrl,
  quoteIdent,
} from '../platform/pg-admin.util';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private loadBootstrapSql(): string {
    return this.loadSqlFile('001_bootstrap.sql');
  }

  private loadSqlFile(name: string): string {
    const candidates = [
      join(__dirname, 'sql', name),
      join(process.cwd(), 'src', 'tenants', 'sql', name),
      join(process.cwd(), 'dist', 'tenants', 'sql', name),
    ];
    for (const p of candidates) {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        /* try next */
      }
    }
    throw new BadRequestException(`Tenant SQL not found: ${name}`);
  }

  private async adminClient(): Promise<Client> {
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
    return client;
  }

  async provisionCompany(
    companyId: string,
    opts?: { force?: boolean; actorName?: string },
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { tenantDatabase: true },
    });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);

    let row = company.tenantDatabase;
    if (!row) {
      row = await this.prisma.tenantDatabase.create({
        data: {
          companyId,
          dbName: tenantDbName(company.slug),
          host: parseAdminUrl(this.config).host,
          port: parseAdminUrl(this.config).port,
          status: 'pending_provision',
        },
      });
    }

    if (row.status === 'active' && row.connectionCiphertext && !opts?.force) {
      return {
        companyId,
        dbName: row.dbName,
        status: row.status,
        provisionedAt: row.provisionedAt,
        message: 'Already provisioned',
      };
    }

    const admin = parseAdminUrl(this.config);
    const dbName = row.dbName || tenantDbName(company.slug);

    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'provisioning' },
    });
    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        status: 'provisioning',
        lastError: '',
        dbName,
        host: admin.host,
        port: admin.port,
      },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.provision.started',
        actorName: opts?.actorName || 'system',
        detail: { dbName, phase: 2 },
      },
    });

    const adminClient = await this.adminClient();
    try {
      const exists = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName],
      );
      if (exists.rowCount === 0) {
        this.logger.log(`Creating database ${dbName}`);
        await adminClient.query(
          `CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(admin.user)}`,
        );
      } else if (!opts?.force) {
        this.logger.log(`Database ${dbName} already exists — applying schema`);
      }

      // Ensure connect privilege for app user
      await adminClient.query(
        `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(dbName)} TO ${quoteIdent(admin.user)}`,
      );
    } catch (e: any) {
      const msg = e?.message || String(e);
      await this.fail(companyId, dbName, msg, opts?.actorName);
      throw new BadRequestException(`Provision failed: ${msg}`);
    } finally {
      await adminClient.end().catch(() => undefined);
    }

    const tenantUrl = buildTenantUrl(admin, dbName);
    const tenantClient = new Client({ connectionString: tenantUrl });
    try {
      await tenantClient.connect();
      const sql = this.loadBootstrapSql();
      await tenantClient.query(sql);
      try {
        const phase5 = this.loadSqlFile('002_phase5_org.sql');
        await tenantClient.query(phase5);
      } catch (e) {
        this.logger.warn(`Phase 5 org SQL skipped: ${String(e)}`);
      }
      try {
        const customRoles = this.loadSqlFile('003_custom_roles.sql');
        await tenantClient.query(customRoles);
      } catch (e) {
        this.logger.warn(`Custom roles SQL skipped: ${String(e)}`);
      }
      try {
        const hardening = this.loadSqlFile('004_auth_hardening.sql');
        await tenantClient.query(hardening);
      } catch (e) {
        this.logger.warn(`Auth hardening SQL skipped: ${String(e)}`);
      }
      try {
        const staffInvite = this.loadSqlFile('005_staff_invite.sql');
        await tenantClient.query(staffInvite);
      } catch (e) {
        this.logger.warn(`Staff invite SQL skipped: ${String(e)}`);
      }
      await this.seedDefaults(tenantClient, companyId, company.name);
    } catch (e: any) {
      const msg = e?.message || String(e);
      await this.fail(companyId, dbName, msg, opts?.actorName);
      throw new BadRequestException(`Schema bootstrap failed: ${msg}`);
    } finally {
      await tenantClient.end().catch(() => undefined);
    }

    const ciphertext = encryptSecret(tenantUrl);
    const defaultRouting =
      this.config.get<string>('TENANT_DEFAULT_ROUTING_MODE') === 'tenant'
        ? 'tenant'
        : 'shared';
    const updated = await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        status: 'active',
        connectionCiphertext: ciphertext,
        lastError: '',
        schemaVersion: '3',
        routingMode: defaultRouting,
        provisionedAt: new Date(),
        host: admin.host,
        port: admin.port,
        dbName,
      },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'active', active: true },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.provision.completed',
        actorName: opts?.actorName || 'system',
        detail: { dbName, schemaVersion: '3', phase: 3 },
      },
    });

    this.logger.log(`Provisioned ${dbName} for company ${companyId}`);
    return {
      companyId,
      dbName: updated.dbName,
      status: updated.status,
      provisionedAt: updated.provisionedAt,
      schemaVersion: updated.schemaVersion,
      message: 'Tenant database provisioned',
    };
  }

  private async seedDefaults(
    client: Client,
    companyId: string,
    companyName: string,
  ) {
    const departments = [
      ['Dispatch', 'dispatch'],
      ['Fleet Maintenance', 'fleet'],
      ['Accounting', 'accounting'],
      ['Safety & Compliance', 'safety'],
      ['Human Resources', 'hr'],
      ['Operations', 'ops'],
      ['Administration', 'admin'],
    ];
    for (const [name, code] of departments) {
      const id = `dept_${companyId}_${code}`;
      await client.query(
        `INSERT INTO company_local."Department" ("id","companyId","name","code")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("id") DO NOTHING`,
        [id, companyId, name, code],
      );
    }

    const settingsId = `settings_${companyId}`;
    await client.query(
      `INSERT INTO company_local."CompanySettings"
        ("id","companyId","general","dispatch","driver","accounting","maintenance","compliance")
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)
       ON CONFLICT ("companyId") DO NOTHING`,
      [
        settingsId,
        companyId,
        JSON.stringify({
          language: 'en',
          currency: 'CAD',
          distanceUnit: 'km',
          weightUnit: 'kg',
          timeZone: 'America/Edmonton',
        }),
        JSON.stringify({
          autoDispatchNumber: true,
          driverAcceptanceRequired: false,
        }),
        JSON.stringify({ requireDriverApproval: true }),
        JSON.stringify({ invoicePrefix: 'INV-', settlementPrefix: 'SET-' }),
        JSON.stringify({ defaultPmIntervalDays: 90 }),
        JSON.stringify({ docAlertDays: 30 }),
      ],
    );

    await client.query(
      `INSERT INTO company_local."CompanyBranding" ("id","companyId")
       VALUES ($1,$2)
       ON CONFLICT ("companyId") DO NOTHING`,
      [`brand_${companyId}`, companyId],
    );

    await client.query(
      `INSERT INTO company_local."Branch"
        ("id","companyId","name","address","timeZone","currency")
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("id") DO NOTHING`,
      [
        `branch_${companyId}_hq`,
        companyId,
        `${companyName} HQ`,
        '',
        'America/Edmonton',
        'CAD',
      ],
    );

    // Default COA stubs
    const accounts = [
      ['1000', 'Cash', 'asset'],
      ['1100', 'Accounts Receivable', 'asset'],
      ['2000', 'Accounts Payable', 'liability'],
      ['4000', 'Freight Revenue', 'revenue'],
      ['5000', 'Fuel Expense', 'expense'],
      ['5100', 'Driver Pay', 'expense'],
      ['5200', 'Maintenance', 'expense'],
    ];
    for (const [code, name, type] of accounts) {
      await client.query(
        `INSERT INTO accounting."LedgerAccount" ("id","companyId","code","name","type")
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT ("companyId","code") DO NOTHING`,
        [`acct_${companyId}_${code}`, companyId, code, name, type],
      );
    }
  }

  private async fail(
    companyId: string,
    dbName: string,
    message: string,
    actorName?: string,
  ) {
    this.logger.error(`Provision failed for ${dbName}: ${message}`);
    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: { status: 'failed', lastError: message.slice(0, 2000) },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'failed' },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.provision.failed',
        actorName: actorName || 'system',
        detail: { dbName, error: message.slice(0, 500), phase: 2 },
      },
    });
  }

  /**
   * Soft deprovision: revoke CONNECT, mark suspended. DB kept for restore.
   * Set dropDatabase=true only for irreversible destroy.
   */
  async deprovisionCompany(
    companyId: string,
    opts?: { dropDatabase?: boolean; actorName?: string },
  ) {
    const row = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
      include: { company: true },
    });
    if (!row) throw new NotFoundException(`Tenant ${companyId} not found`);

    const admin = parseAdminUrl(this.config);
    const adminClient = await this.adminClient();
    try {
      const exists = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [row.dbName],
      );
      if (exists.rowCount && exists.rowCount > 0) {
        await adminClient.query(
          `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()
          `,
          [row.dbName],
        );
        if (opts?.dropDatabase) {
          await adminClient.query(
            `DROP DATABASE IF EXISTS ${quoteIdent(row.dbName)}`,
          );
        } else {
          // Revoke connect from public/app user — still owned; restore later
          await adminClient.query(
            `REVOKE CONNECT ON DATABASE ${quoteIdent(row.dbName)} FROM PUBLIC`,
          );
          try {
            await adminClient.query(
              `REVOKE CONNECT ON DATABASE ${quoteIdent(row.dbName)} FROM ${quoteIdent(admin.user)}`,
            );
          } catch {
            /* owner may always connect */
          }
        }
      }
    } finally {
      await adminClient.end().catch(() => undefined);
    }

    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        status: 'suspended',
        connectionCiphertext: opts?.dropDatabase
          ? ''
          : row.connectionCiphertext,
        lastError: opts?.dropDatabase ? 'database dropped' : '',
      },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'suspended', active: false },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: opts?.dropDatabase
          ? 'tenant.deprovision.dropped'
          : 'tenant.deprovision.suspended',
        actorName: opts?.actorName || 'system',
        detail: { dbName: row.dbName, phase: 2 },
      },
    });

    return {
      companyId,
      dbName: row.dbName,
      status: 'suspended',
      dropped: Boolean(opts?.dropDatabase),
    };
  }

  async provisionAllPending(actorName = 'system') {
    const pending = await this.prisma.tenantDatabase.findMany({
      where: { status: { in: ['pending_provision', 'failed'] } },
    });
    const results: unknown[] = [];
    for (const row of pending) {
      try {
        results.push(
          await this.provisionCompany(row.companyId, { actorName }),
        );
      } catch (e: any) {
        results.push({
          companyId: row.companyId,
          error: e?.message || String(e),
        });
      }
    }
    return { count: pending.length, results };
  }
}
