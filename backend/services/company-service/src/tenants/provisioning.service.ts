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
import {
  buildCommodityNormalizedKey,
  DEFAULT_COMMODITIES,
} from '../mdm/catalog.util';
import {
  DEFAULT_PORTS,
  uniqueBorderCrossingNames,
} from '../mdm/border.util';
import {
  DEFAULT_COST_CENTERS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYROLL_CATEGORIES,
  REF_KIND_EXPENSE,
} from '../mdm/ops-ref.util';

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
      try {
        const inviteLife = this.loadSqlFile('006_invite_lifecycle.sql');
        await tenantClient.query(inviteLife);
      } catch (e) {
        this.logger.warn(`Invite lifecycle SQL skipped: ${String(e)}`);
      }
      try {
        const pwPolicy = this.loadSqlFile('007_password_policy.sql');
        await tenantClient.query(pwPolicy);
      } catch (e) {
        this.logger.warn(`Password policy SQL skipped: ${String(e)}`);
      }
      try {
        const secNotify = this.loadSqlFile('008_security_notifications.sql');
        await tenantClient.query(secNotify);
      } catch (e) {
        this.logger.warn(`Security notifications SQL skipped: ${String(e)}`);
      }
      try {
        const mdmFleet = this.loadSqlFile('009_mdm_fleet_phase1.sql');
        await tenantClient.query(mdmFleet);
      } catch (e) {
        this.logger.warn(`MDM fleet Phase 1 SQL skipped: ${String(e)}`);
      }
      try {
        const mdmParties = this.loadSqlFile('010_mdm_parties_phase2.sql');
        await tenantClient.query(mdmParties);
      } catch (e) {
        this.logger.warn(`MDM parties Phase 2 SQL skipped: ${String(e)}`);
      }
      try {
        const mdmCarriers = this.loadSqlFile('011_mdm_carriers_phase3.sql');
        await tenantClient.query(mdmCarriers);
      } catch (e) {
        this.logger.warn(`MDM carriers Phase 3 SQL skipped: ${String(e)}`);
      }
      try {
        const mdmCatalogs = this.loadSqlFile('012_mdm_catalogs_phase4.sql');
        await tenantClient.query(mdmCatalogs);
      } catch (e) {
        this.logger.warn(`MDM catalogs Phase 4 SQL skipped: ${String(e)}`);
      }
      try {
        const mdmBorder = this.loadSqlFile('013_mdm_border_phase5.sql');
        await tenantClient.query(mdmBorder);
      } catch (e) {
        this.logger.warn(`MDM border Phase 5 SQL skipped: ${String(e)}`);
      }
      try {
        const mdmOps = this.loadSqlFile('014_mdm_ops_phase6.sql');
        await tenantClient.query(mdmOps);
      } catch (e) {
        this.logger.warn(`MDM ops Phase 6 SQL skipped: ${String(e)}`);
      }
      try {
        const driverCh6 = this.loadSqlFile('015_driver_chapter6.sql');
        await tenantClient.query(driverCh6);
      } catch (e) {
        this.logger.warn(`Driver Chapter 6 SQL skipped: ${String(e)}`);
      }
      try {
        const driverCh6b = this.loadSqlFile('016_driver_chapter6_phase4567.sql');
        await tenantClient.query(driverCh6b);
      } catch (e) {
        this.logger.warn(`Driver Chapter 6 phase 4-7 SQL skipped: ${String(e)}`);
      }
      await this.seedDefaults(tenantClient, companyId, company.name);
      await this.seedEquipmentTypes(tenantClient, companyId);
      await this.seedCommodities(tenantClient, companyId);
      await this.seedBorderPorts(tenantClient, companyId);
      await this.seedOpsRefs(tenantClient, companyId);
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

  private async seedEquipmentTypes(client: Client, companyId: string) {
    const types: Array<{ code: string; name: string }> = [
      { code: 'dry_van', name: 'Dry Van' },
      { code: 'reefer', name: 'Reefer' },
      { code: 'flatbed', name: 'Flatbed' },
      { code: 'step_deck', name: 'Step Deck' },
      { code: 'double_drop', name: 'Double Drop' },
      { code: 'rgn', name: 'RGN' },
      { code: 'power_only', name: 'Power Only' },
      { code: 'container', name: 'Container' },
      { code: 'tanker', name: 'Tanker' },
      { code: 'hopper', name: 'Hopper' },
      { code: 'car_hauler', name: 'Car Hauler' },
    ];
    for (const t of types) {
      await client.query(
        `INSERT INTO fleet."EquipmentType"
          ("id","companyId","code","name","system","status")
         VALUES ($1,$2,$3,$4,true,'active')
         ON CONFLICT ("companyId","code") DO NOTHING`,
        [`eqt_${companyId}_${t.code}`, companyId, t.code, t.name],
      );
    }
  }

  private async seedCommodities(client: Client, companyId: string) {
    for (const t of DEFAULT_COMMODITIES) {
      const key = buildCommodityNormalizedKey(t.name);
      await client.query(
        `INSERT INTO company_local."Commodity"
          ("id","companyId","name","nmfc","hazmat","status","normalizedKey","system")
         VALUES ($1,$2,$3,$4,$5,'active',$6,true)
         ON CONFLICT ("companyId","normalizedKey") DO NOTHING`,
        [
          `cmd_${companyId}_${t.code}`.slice(0, 64),
          companyId,
          t.name,
          t.nmfc || '',
          t.hazmat,
          key,
        ],
      );
    }
  }

  private async seedBorderPorts(client: Client, companyId: string) {
    for (const name of uniqueBorderCrossingNames()) {
      await client.query(
        `INSERT INTO company_local."BorderCrossing"
          ("id","companyId","name","countries","status","system")
         VALUES ($1,$2,$3,'CA-US','active',true)
         ON CONFLICT ("companyId","name") DO NOTHING`,
        [
          `bcx_${companyId}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
          companyId,
          name,
        ],
      );
    }
    const crossings = await client.query(
      `SELECT "id","name" FROM company_local."BorderCrossing" WHERE "companyId"=$1`,
      [companyId],
    );
    const byName = new Map(
      crossings.rows.map((r: { id: string; name: string }) => [r.name, r.id]),
    );
    for (const p of DEFAULT_PORTS) {
      await client.query(
        `INSERT INTO company_local."PortOfEntry"
          ("id","companyId","code","name","country","borderCrossingId","borderCrossingName",
           "fastLane","ace","aci","paps","pars","restrictions","status","system")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',true)
         ON CONFLICT ("companyId","code") DO NOTHING`,
        [
          `poe_${companyId}_${p.code}`.slice(0, 64),
          companyId,
          p.code,
          p.name,
          p.country,
          byName.get(p.borderCrossing) || null,
          p.borderCrossing,
          Boolean(p.fastLane),
          p.ace,
          p.aci,
          p.paps,
          p.pars,
          p.restrictions || '',
        ],
      );
    }
  }

  private async seedOpsRefs(client: Client, companyId: string) {
    for (const t of DEFAULT_COST_CENTERS) {
      await client.query(
        `INSERT INTO company_local."CostCenter"
          ("id","companyId","code","name","status","system")
         VALUES ($1,$2,$3,$4,'active',true)
         ON CONFLICT ("companyId","code") DO NOTHING`,
        [`cc_${companyId}_${t.code}`.slice(0, 64), companyId, t.code, t.name],
      );
    }
    for (const t of DEFAULT_PAYROLL_CATEGORIES) {
      await client.query(
        `INSERT INTO company_local."PayrollCategory"
          ("id","companyId","code","name","status","system")
         VALUES ($1,$2,$3,$4,'active',true)
         ON CONFLICT ("companyId","code") DO NOTHING`,
        [`pay_${companyId}_${t.code}`.slice(0, 64), companyId, t.code, t.name],
      );
    }
    for (const t of DEFAULT_EXPENSE_CATEGORIES) {
      await client.query(
        `INSERT INTO company_local."ReferenceData"
          ("id","companyId","kind","code","name","status","system")
         VALUES ($1,$2,$3,$4,$5,'active',true)
         ON CONFLICT ("companyId","kind","code") DO NOTHING`,
        [
          `ref_${companyId}_${t.code}`.slice(0, 64),
          companyId,
          REF_KIND_EXPENSE,
          t.code,
          t.name,
        ],
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

  /**
   * Restore soft-suspended tenant: re-grant CONNECT and mark active.
   * Does not re-run bootstrap — use provisionCompany when the DB was dropped.
   */
  async restoreSuspendedCompany(
    companyId: string,
    opts?: { actorName?: string },
  ) {
    const row = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
      include: { company: true },
    });
    if (!row) {
      return this.provisionCompany(companyId, { actorName: opts?.actorName });
    }

    const admin = parseAdminUrl(this.config);
    const dbName = row.dbName || tenantDbName(row.company.slug);

    const adminClient = await this.adminClient();
    try {
      const exists = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName],
      );
      if (exists.rowCount === 0) {
        return this.provisionCompany(companyId, {
          force: true,
          actorName: opts?.actorName,
        });
      }
      await adminClient.query(
        `GRANT CONNECT ON DATABASE ${quoteIdent(dbName)} TO PUBLIC`,
      );
      await adminClient.query(
        `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(dbName)} TO ${quoteIdent(admin.user)}`,
      );
    } finally {
      await adminClient.end().catch(() => undefined);
    }

    let ciphertext = row.connectionCiphertext;
    if (!ciphertext) {
      ciphertext = encryptSecret(buildTenantUrl(admin, dbName));
    }

    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: {
        status: 'active',
        connectionCiphertext: ciphertext,
        lastError: '',
        dbName,
        host: admin.host,
        port: admin.port,
      },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'active', active: true },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.restore.completed',
        actorName: opts?.actorName || 'system',
        detail: { dbName, phase: 2 },
      },
    });

    this.logger.log(`Restored suspended tenant ${dbName} for company ${companyId}`);
    return {
      companyId,
      dbName,
      status: 'active',
      message: 'Tenant database restored',
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
