import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../platform/crypto.util';
import { AuditService } from '../audit/audit.module';
import {
  isCustomRoleBaseRole,
  sanitizePermissionCodes,
  slugifyRoleCode,
} from './custom-role.util';
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

type AuditActor = { id?: string; name?: string };

@Injectable()
export class TenantLocalService {
  private readonly logger = new Logger(TenantLocalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async tenantClient(companyId: string): Promise<Client> {
    const row = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
    });
    if (!row?.connectionCiphertext || row.status !== 'active') {
      throw new BadRequestException(
        'Tenant database not active — provision the company first',
      );
    }
    let url: string;
    try {
      url = decryptSecret(row.connectionCiphertext);
    } catch {
      throw new BadRequestException('Failed to decrypt tenant connection');
    }
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
  }

  /** Public tenant pg client for MDM module (caller must `.end()`). */
  openTenantClient(companyId: string): Promise<Client> {
    return this.tenantClient(companyId);
  }

  /** Ensure Phase 5 org tables exist (idempotent). */
  async ensurePhase5Schema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('002_phase5_org.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Ensure Phase 3 custom-role tables exist (idempotent). */
  async ensureCustomRolesSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('003_custom_roles.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Ensure Phase 4 auth-hardening columns exist on SecurityPolicy. */
  async ensureAuthHardeningSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('004_auth_hardening.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Ensure tenant Invite.kind/role/email/name exist. */
  async ensureStaffInviteSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('005_staff_invite.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Ensure invite TTL policy + Invite.expiresAt. */
  async ensureInviteLifecycleSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('006_invite_lifecycle.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Ensure password history count on SecurityPolicy. */
  async ensurePasswordPolicySchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('007_password_policy.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Ensure default security notification rules. */
  async ensureSecurityNotificationsSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('008_security_notifications.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 5 MDM Phase 1: asset status + EquipmentType catalog. */
  async ensureMdmFleetSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('009_mdm_fleet_phase1.sql');
      await client.query(sql);
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
            ("id","companyId","code","name","system","status","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,true,'active',NOW(),NOW())
           ON CONFLICT ("companyId","code") DO NOTHING`,
          [`eqt_${companyId}_${t.code}`, companyId, t.code, t.name],
        );
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 5 MDM Phase 2: Location + Broker/Customer/Consignee. */
  async ensureMdmPartiesSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('010_mdm_parties_phase2.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 5 MDM Phase 3: subcontract Carrier (+ Load.carrierId). */
  async ensureMdmCarriersSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('011_mdm_carriers_phase3.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 5 MDM Phase 4: Commodity + Warehouse catalogs. */
  async ensureMdmCatalogsSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('012_mdm_catalogs_phase4.sql');
      await client.query(sql);
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
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 5 MDM Phase 5: Border crossings + Ports of Entry. */
  async ensureMdmBorderSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('013_mdm_border_phase5.sql');
      await client.query(sql);
      for (const name of uniqueBorderCrossingNames()) {
        await client.query(
          `INSERT INTO company_local."BorderCrossing"
            ("id","companyId","name","countries","status","system")
           VALUES ($1,$2,$3,'CA-US','active',true)
           ON CONFLICT ("companyId","name") DO NOTHING`,
          [`bcx_${companyId}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64), companyId, name],
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
        const bcxId = byName.get(p.borderCrossing) || null;
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
            bcxId,
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
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 5 MDM Phase 6: vendors, fuel, insurance, cost/payroll refs. */
  async ensureMdmOpsSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('014_mdm_ops_phase6.sql');
      await client.query(sql);
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
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 6 Driver Management Phases 1–3. */
  async ensureDriverChapter6Schema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('015_driver_chapter6.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Chapter 6 Driver Management Phases 4–7. */
  async ensureDriverChapter6Phase4567Schema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('016_driver_chapter6_phase4567.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** MDM Phase 8: invoice broker columns + accounting Prisma parity. */
  async ensureMdmPhase8InvoiceBrokerSchema(companyId: string) {
    const client = await this.tenantClient(companyId);
    try {
      const sql = this.loadSql('017_mdm_phase8_invoice_broker.sql');
      await client.query(sql);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Apply all org-side tenant SQL migrations (idempotent). */
  async ensureAllTenantOrgSchemas(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    await this.ensureCustomRolesSchema(companyId);
    await this.ensureAuthHardeningSchema(companyId);
    await this.ensureStaffInviteSchema(companyId);
    await this.ensureInviteLifecycleSchema(companyId);
    await this.ensurePasswordPolicySchema(companyId);
    await this.ensureSecurityNotificationsSchema(companyId);
    await this.ensureMdmFleetSchema(companyId);
    await this.ensureMdmPartiesSchema(companyId);
    await this.ensureMdmCarriersSchema(companyId);
    await this.ensureMdmCatalogsSchema(companyId);
    await this.ensureMdmBorderSchema(companyId);
    await this.ensureMdmOpsSchema(companyId);
    await this.ensureMdmPhase8InvoiceBrokerSchema(companyId);
    await this.ensureDriverChapter6Schema(companyId);
    await this.ensureDriverChapter6Phase4567Schema(companyId);
  }

  private loadSql(name: string): string {
    const candidates = [
      join(__dirname, '..', 'tenants', 'sql', name),
      join(__dirname, '..', '..', 'tenants', 'sql', name),
      join(process.cwd(), 'src', 'tenants', 'sql', name),
      join(process.cwd(), 'dist', 'tenants', 'sql', name),
    ];
    for (const p of candidates) {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        /* next */
      }
    }
    throw new BadRequestException(`SQL asset missing: ${name}`);
  }

  // ── Settings ─────────────────────────────────────────────────────
  async getSettings(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."CompanySettings" WHERE "companyId" = $1`,
        [companyId],
      );
      return res.rows[0] || null;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async patchSettings(companyId: string, packs: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const allowed = [
        'general',
        'dispatch',
        'driver',
        'accounting',
        'maintenance',
        'compliance',
      ] as const;
      const existing = await c.query(
        `SELECT * FROM company_local."CompanySettings" WHERE "companyId" = $1`,
        [companyId],
      );
      if (!existing.rows[0]) {
        throw new NotFoundException('CompanySettings not found — re-provision');
      }
      const row = existing.rows[0];
      for (const key of allowed) {
        if (packs[key] && typeof packs[key] === 'object') {
          row[key] = { ...(row[key] || {}), ...(packs[key] as object) };
        }
      }
      await c.query(
        `UPDATE company_local."CompanySettings"
         SET "general"=$2::jsonb, "dispatch"=$3::jsonb, "driver"=$4::jsonb,
             "accounting"=$5::jsonb, "maintenance"=$6::jsonb, "compliance"=$7::jsonb,
             "updatedAt"=NOW()
         WHERE "companyId"=$1`,
        [
          companyId,
          JSON.stringify(row.general || {}),
          JSON.stringify(row.dispatch || {}),
          JSON.stringify(row.driver || {}),
          JSON.stringify(row.accounting || {}),
          JSON.stringify(row.maintenance || {}),
          JSON.stringify(row.compliance || {}),
        ],
      );
      return this.getSettings(companyId);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Branding ─────────────────────────────────────────────────────
  async getBranding(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."CompanyBranding" WHERE "companyId" = $1`,
        [companyId],
      );
      return res.rows[0] || null;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async patchBranding(companyId: string, body: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const fields = [
        'logoUrl',
        'primaryColor',
        'secondaryColor',
        'accentColor',
        'invoiceHeader',
        'invoiceFooter',
      ] as const;
      const sets: string[] = [];
      const vals: unknown[] = [companyId];
      let i = 2;
      for (const f of fields) {
        if (body[f] !== undefined) {
          sets.push(`"${f}"=$${i++}`);
          vals.push(String(body[f]));
        }
      }
      if (!sets.length) return this.getBranding(companyId);
      sets.push(`"updatedAt"=NOW()`);
      await c.query(
        `UPDATE company_local."CompanyBranding" SET ${sets.join(', ')} WHERE "companyId"=$1`,
        vals,
      );
      return this.getBranding(companyId);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Branches ─────────────────────────────────────────────────────
  async listBranches(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Branch" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      return res.rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async upsertBranch(companyId: string, body: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const id = String(body.id || `branch_${companyId}_${Date.now()}`);
      await c.query(
        `INSERT INTO company_local."Branch"
          ("id","companyId","name","address","phone","email","managerName","timeZone","currency","active")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT ("id") DO UPDATE SET
           "name"=EXCLUDED."name", "address"=EXCLUDED."address", "phone"=EXCLUDED."phone",
           "email"=EXCLUDED."email", "managerName"=EXCLUDED."managerName",
           "timeZone"=EXCLUDED."timeZone", "currency"=EXCLUDED."currency",
           "active"=EXCLUDED."active", "updatedAt"=NOW()`,
        [
          id,
          companyId,
          String(body.name || 'Branch'),
          String(body.address || ''),
          String(body.phone || ''),
          String(body.email || ''),
          String(body.managerName || ''),
          String(body.timeZone || 'America/Edmonton'),
          String(body.currency || 'CAD'),
          body.active === false ? false : true,
        ],
      );
      const res = await c.query(
        `SELECT * FROM company_local."Branch" WHERE "id"=$1`,
        [id],
      );
      return res.rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async softDeleteBranch(companyId: string, branchId: string) {
    const c = await this.tenantClient(companyId);
    try {
      await c.query(
        `UPDATE company_local."Branch" SET "active"=false, "updatedAt"=NOW()
         WHERE "id"=$1 AND "companyId"=$2`,
        [branchId, companyId],
      );
      return { ok: true, id: branchId, active: false };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Departments ──────────────────────────────────────────────────
  async listDepartments(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Department" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      return res.rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async upsertDepartment(companyId: string, body: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const code = String(body.code || 'dept').toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = String(body.id || `dept_${companyId}_${code || Date.now()}`);
      await c.query(
        `INSERT INTO company_local."Department" ("id","companyId","name","code")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "code"=EXCLUDED."code"`,
        [id, companyId, String(body.name || 'Department'), code],
      );
      const res = await c.query(
        `SELECT * FROM company_local."Department" WHERE "id"=$1`,
        [id],
      );
      return res.rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Document vault ───────────────────────────────────────────────
  async listDocuments(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."CompanyDocument" WHERE "companyId"=$1 ORDER BY "createdAt" DESC`,
        [companyId],
      );
      return res.rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createDocument(companyId: string, body: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const id = `cdoc_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."CompanyDocument"
          ("id","companyId","name","type","fileName","fileUrl","fileSize","uploadedBy","expiresAt","notes")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          companyId,
          String(body.name || 'Document'),
          String(body.type || 'general'),
          String(body.fileName || ''),
          String(body.fileUrl || ''),
          body.fileSize != null ? Number(body.fileSize) : null,
          String(body.uploadedBy || ''),
          String(body.expiresAt || ''),
          String(body.notes || ''),
        ],
      );
      const res = await c.query(
        `SELECT * FROM company_local."CompanyDocument" WHERE "id"=$1`,
        [id],
      );
      return res.rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async deleteDocument(companyId: string, docId: string) {
    const c = await this.tenantClient(companyId);
    try {
      await c.query(
        `DELETE FROM company_local."CompanyDocument" WHERE "id"=$1 AND "companyId"=$2`,
        [docId, companyId],
      );
      return { ok: true };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── API credentials ──────────────────────────────────────────────
  async listApiKeys(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT "id","companyId","name","keyPrefix","scopes","active","lastUsedAt","createdAt","revokedAt"
         FROM company_local."ApiCredential" WHERE "companyId"=$1 ORDER BY "createdAt" DESC`,
        [companyId],
      );
      return res.rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createApiKey(companyId: string, body: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const raw = `fq_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const keyPrefix = raw.slice(0, 10);
    const id = `akey_${randomBytes(6).toString('hex')}`;
    const c = await this.tenantClient(companyId);
    try {
      await c.query(
        `INSERT INTO company_local."ApiCredential"
          ("id","companyId","name","keyPrefix","keyHash","scopes","active")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,true)`,
        [
          id,
          companyId,
          String(body.name || 'API Key'),
          keyPrefix,
          keyHash,
          JSON.stringify(body.scopes || ['read']),
        ],
      );
      return {
        id,
        name: String(body.name || 'API Key'),
        keyPrefix,
        /** Shown once — store securely */
        apiKey: raw,
        scopes: body.scopes || ['read'],
      };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async revokeApiKey(companyId: string, keyId: string) {
    const c = await this.tenantClient(companyId);
    try {
      await c.query(
        `UPDATE company_local."ApiCredential"
         SET "active"=false, "revokedAt"=NOW()
         WHERE "id"=$1 AND "companyId"=$2`,
        [keyId, companyId],
      );
      return { ok: true };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Security policy ──────────────────────────────────────────────
  async getSecurityPolicy(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    await this.ensureAuthHardeningSchema(companyId);
    await this.ensureInviteLifecycleSchema(companyId);
    await this.ensurePasswordPolicySchema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      let res = await c.query(
        `SELECT * FROM company_local."SecurityPolicy" WHERE "companyId"=$1`,
        [companyId],
      );
      if (!res.rows[0]) {
        const id = `sec_${companyId}`;
        await c.query(
          `INSERT INTO company_local."SecurityPolicy" ("id","companyId") VALUES ($1,$2)
           ON CONFLICT ("companyId") DO NOTHING`,
          [id, companyId],
        );
        res = await c.query(
          `SELECT * FROM company_local."SecurityPolicy" WHERE "companyId"=$1`,
          [companyId],
        );
      }
      return res.rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async patchSecurityPolicy(companyId: string, body: Record<string, unknown>) {
    await this.getSecurityPolicy(companyId);
    const c = await this.tenantClient(companyId);
    try {
      await c.query(
        `UPDATE company_local."SecurityPolicy" SET
           "passwordMinLength"=COALESCE($2,"passwordMinLength"),
           "sessionDays"=COALESCE($3,"sessionDays"),
           "requireMfa"=COALESCE($4,"requireMfa"),
           "ipAllowlist"=COALESCE($5::jsonb,"ipAllowlist"),
           "passwordComplexity"=COALESCE($6,"passwordComplexity"),
           "lockoutThreshold"=COALESCE($7,"lockoutThreshold"),
           "lockoutMinutes"=COALESCE($8,"lockoutMinutes"),
           "idleTimeoutMinutes"=COALESCE($9,"idleTimeoutMinutes"),
           "inviteTtlDays"=COALESCE($10,"inviteTtlDays"),
           "passwordHistoryCount"=COALESCE($11,"passwordHistoryCount"),
           "updatedAt"=NOW()
         WHERE "companyId"=$1`,
        [
          companyId,
          body.passwordMinLength != null
            ? Math.min(128, Math.max(4, Number(body.passwordMinLength)))
            : null,
          body.sessionDays != null
            ? Math.min(90, Math.max(1, Number(body.sessionDays)))
            : null,
          body.requireMfa != null ? Boolean(body.requireMfa) : null,
          body.ipAllowlist != null ? JSON.stringify(body.ipAllowlist) : null,
          body.passwordComplexity != null
            ? Boolean(body.passwordComplexity)
            : null,
          body.lockoutThreshold != null
            ? Math.min(20, Math.max(3, Number(body.lockoutThreshold)))
            : null,
          body.lockoutMinutes != null
            ? Math.min(1440, Math.max(1, Number(body.lockoutMinutes)))
            : null,
          body.idleTimeoutMinutes != null
            ? Math.min(480, Math.max(0, Number(body.idleTimeoutMinutes)))
            : null,
          body.inviteTtlDays != null
            ? Math.min(90, Math.max(1, Number(body.inviteTtlDays)))
            : null,
          body.passwordHistoryCount != null
            ? Math.min(24, Math.max(0, Number(body.passwordHistoryCount)))
            : null,
        ],
      );
      return this.getSecurityPolicy(companyId);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Notification rules ───────────────────────────────────────────
  async listNotificationRules(companyId: string) {
    await this.ensurePhase5Schema(companyId);
    await this.ensureSecurityNotificationsSchema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      let res = await c.query(
        `SELECT * FROM company_local."NotificationRule" WHERE "companyId"=$1 ORDER BY "eventType"`,
        [companyId],
      );
      if (!res.rows.length) {
        const id = `nrule_${companyId}_doc_expiry`;
        await c.query(
          `INSERT INTO company_local."NotificationRule"
            ("id","companyId","eventType","channel","target","enabled","config")
           VALUES ($1,$2,'doc_expiry','sms','admin',true,'{}'::jsonb)
           ON CONFLICT ("id") DO NOTHING`,
          [id, companyId],
        );
        res = await c.query(
          `SELECT * FROM company_local."NotificationRule" WHERE "companyId"=$1 ORDER BY "eventType"`,
          [companyId],
        );
      }
      return res.rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async upsertNotificationRule(companyId: string, body: Record<string, unknown>) {
    await this.ensurePhase5Schema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const id = String(
        body.id ||
          `nrule_${companyId}_${String(body.eventType || 'event').replace(/[^a-z0-9_]/gi, '')}`,
      );
      await c.query(
        `INSERT INTO company_local."NotificationRule"
          ("id","companyId","eventType","channel","target","enabled","config")
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT ("id") DO UPDATE SET
           "eventType"=EXCLUDED."eventType", "channel"=EXCLUDED."channel",
           "target"=EXCLUDED."target", "enabled"=EXCLUDED."enabled",
           "config"=EXCLUDED."config", "updatedAt"=NOW()`,
        [
          id,
          companyId,
          String(body.eventType || 'doc_expiry'),
          String(body.channel || 'sms'),
          String(body.target || 'admin'),
          body.enabled === false ? false : true,
          JSON.stringify(body.config || {}),
        ],
      );
      const res = await c.query(
        `SELECT * FROM company_local."NotificationRule" WHERE "id"=$1`,
        [id],
      );
      return res.rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Custom roles (RBAC Phase 3) ──────────────────────────────────
  async listCustomRoles(companyId: string) {
    await this.ensureCustomRolesSchema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT r.*, COALESCE(
           array_agg(p."permissionCode") FILTER (WHERE p."permissionCode" IS NOT NULL),
           '{}'
         ) AS permissions
         FROM company_local."CustomRole" r
         LEFT JOIN company_local."CustomRolePermission" p ON p."roleId" = r.id
         WHERE r."companyId" = $1
         GROUP BY r.id
         ORDER BY r.name ASC`,
        [companyId],
      );
      return res.rows.map((row) => this.mapCustomRole(row));
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async getCustomRole(companyId: string, roleId: string) {
    await this.ensureCustomRolesSchema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      return await this.loadCustomRole(c, companyId, roleId);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createCustomRole(
    companyId: string,
    body: Record<string, unknown>,
    actor?: AuditActor,
  ) {
    await this.ensureCustomRolesSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name is required');
    const baseRole = String(body.baseRole || '');
    if (!isCustomRoleBaseRole(baseRole)) {
      throw new BadRequestException(
        'baseRole must be a staff system role (not owner or Super Admin)',
      );
    }
    const sanitized = sanitizePermissionCodes(body.permissions);
    if (sanitized.rejected.length) {
      throw new BadRequestException(
        `Unknown permission codes: ${sanitized.rejected.join(', ')}`,
      );
    }
    const description = String(body.description || '');
    const id = `crole_${randomBytes(10).toString('hex')}`;
    const c = await this.tenantClient(companyId);
    try {
      const code = await this.uniqueRoleCode(c, companyId, slugifyRoleCode(name));
      await c.query(
        `INSERT INTO company_local."CustomRole"
          ("id","companyId","code","name","description","baseRole")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, companyId, code, name, description, baseRole],
      );
      await this.replaceRolePermissions(c, id, sanitized.permissions);
      const created = await this.loadCustomRole(c, companyId, id);
      await this.auditPermissionModified(companyId, actor, {
        entityId: id,
        after: created,
        meta: { op: 'create', stripped: sanitized.denied },
      });
      return { ...created, stripped: sanitized.denied };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateCustomRole(
    companyId: string,
    roleId: string,
    body: Record<string, unknown>,
    actor?: AuditActor,
  ) {
    await this.ensureCustomRolesSchema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const existing = await this.loadCustomRole(c, companyId, roleId);
      const name =
        body.name !== undefined ? String(body.name || '').trim() : existing.name;
      if (!name) throw new BadRequestException('name is required');
      if (body.baseRole !== undefined && String(body.baseRole) !== existing.baseRole) {
        throw new BadRequestException(
          'baseRole cannot change after create — assign users a different role instead',
        );
      }
      let permissions = existing.permissions;
      let denied: string[] = [];
      if (body.permissions !== undefined) {
        const sanitized = sanitizePermissionCodes(body.permissions);
        if (sanitized.rejected.length) {
          throw new BadRequestException(
            `Unknown permission codes: ${sanitized.rejected.join(', ')}`,
          );
        }
        permissions = sanitized.permissions;
        denied = sanitized.denied;
        await this.replaceRolePermissions(c, roleId, permissions);
      }
      const description =
        body.description !== undefined
          ? String(body.description || '')
          : existing.description;
      const code =
        body.name !== undefined && name !== existing.name
          ? await this.uniqueRoleCode(c, companyId, slugifyRoleCode(name), roleId)
          : existing.code;
      await c.query(
        `UPDATE company_local."CustomRole"
         SET "name"=$1, "description"=$2, "code"=$3, "updatedAt"=NOW()
         WHERE "id"=$4 AND "companyId"=$5`,
        [name, description, code, roleId, companyId],
      );
      const updated = await this.loadCustomRole(c, companyId, roleId);
      await this.auditPermissionModified(companyId, actor, {
        entityId: roleId,
        before: existing,
        after: updated,
        meta: { op: 'update', stripped: denied },
      });
      return { ...updated, stripped: denied };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async deleteCustomRole(
    companyId: string,
    roleId: string,
    actor?: AuditActor,
  ) {
    await this.ensureCustomRolesSchema(companyId);
    const c = await this.tenantClient(companyId);
    try {
      const existing = await this.loadCustomRole(c, companyId, roleId);
      await c.query(
        `DELETE FROM company_local."CustomRole" WHERE "id"=$1 AND "companyId"=$2`,
        [roleId, companyId],
      );
      await this.auditPermissionModified(companyId, actor, {
        entityId: roleId,
        before: existing,
        meta: { op: 'delete' },
      });
      return { ok: true, id: roleId };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  private mapCustomRole(row: Record<string, unknown>) {
    const perms = row.permissions;
    const permissions = Array.isArray(perms)
      ? perms.filter((p) => typeof p === 'string')
      : [];
    return {
      id: String(row.id),
      companyId: String(row.companyId),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      baseRole: String(row.baseRole),
      permissions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async loadCustomRole(
    c: Client,
    companyId: string,
    roleId: string,
  ) {
    const res = await c.query(
      `SELECT r.*, COALESCE(
         array_agg(p."permissionCode") FILTER (WHERE p."permissionCode" IS NOT NULL),
         '{}'
       ) AS permissions
       FROM company_local."CustomRole" r
       LEFT JOIN company_local."CustomRolePermission" p ON p."roleId" = r.id
       WHERE r."id" = $1 AND r."companyId" = $2
       GROUP BY r.id`,
      [roleId, companyId],
    );
    if (!res.rows[0]) throw new NotFoundException('Custom role not found');
    return this.mapCustomRole(res.rows[0]);
  }

  private async uniqueRoleCode(
    c: Client,
    companyId: string,
    base: string,
    excludeId?: string,
  ) {
    let code = base;
    for (let i = 0; i < 8; i++) {
      const res = await c.query(
        `SELECT "id" FROM company_local."CustomRole"
         WHERE "companyId"=$1 AND "code"=$2${excludeId ? ' AND "id"<>$3' : ''}`,
        excludeId ? [companyId, code, excludeId] : [companyId, code],
      );
      if (!res.rows[0]) return code;
      code = `${base}_${randomBytes(2).toString('hex')}`;
    }
    return `${base}_${randomBytes(4).toString('hex')}`;
  }

  private async replaceRolePermissions(
    c: Client,
    roleId: string,
    permissions: string[],
  ) {
    await c.query(
      `DELETE FROM company_local."CustomRolePermission" WHERE "roleId"=$1`,
      [roleId],
    );
    for (const code of permissions) {
      await c.query(
        `INSERT INTO company_local."CustomRolePermission" ("roleId","permissionCode")
         VALUES ($1,$2)`,
        [roleId, code],
      );
    }
  }

  private async auditPermissionModified(
    companyId: string,
    actor: AuditActor | undefined,
    payload: {
      entityId: string;
      before?: unknown;
      after?: unknown;
      meta?: Record<string, unknown>;
    },
  ) {
    try {
      await this.audit.create({
        companyId,
        actorId: actor?.id || null,
        actorName: actor?.name || '',
        action: 'permission.modified',
        entityType: 'custom_role',
        entityId: payload.entityId,
        before: payload.before as object | undefined,
        after: payload.after as object | undefined,
        meta: payload.meta,
      });
    } catch (e) {
      this.logger.warn(`permission.modified audit failed: ${String(e)}`);
    }
  }
}
