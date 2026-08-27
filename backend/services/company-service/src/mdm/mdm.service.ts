import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TenantLocalService } from '../org/tenant-local.service';
import { AuditService } from '../audit/audit.module';
import {
  buildLocationNormalizedKey,
  buildPartyNormalizedKey,
  canSelectPartyStatus,
  namesLikelyDuplicate,
  normalizePartyStatus,
  partySelectBlockReason,
} from './party-status';
import {
  fleetFkColumnForEntity,
  isMdmMergeEntity,
  mergePartyFields,
  type MdmMergeEntity,
} from './merge.util';
import {
  buildCommodityNormalizedKey,
  buildWarehouseNormalizedKey,
  canSelectCatalogStatus,
  DEFAULT_COMMODITIES,
} from './catalog.util';
import {
  customsFlagsFromPort,
  defaultProgramForPort,
  DEFAULT_PORTS,
  uniqueBorderCrossingNames,
  validateCrossBorderDispatch,
} from './border.util';
import {
  buildOpsNormalizedKey,
  isOpsCodedTable,
  isOpsNamedTable,
  slugOpsCode,
} from './ops-ref.util';
import { parseCsv, toCsv } from './csv.util';
import {
  filenameForEntity,
  isMdmIoEntity,
  MDM_IO_COLUMNS,
  validateIoRow,
  type CsvRowError,
  type MdmIoEntity,
} from './mdm-io.util';

type DupHit = {
  id: string;
  name: string;
  status: string;
  reason: string;
};

type AuditActor = { id?: string; name?: string };

@Injectable()
export class MdmService {
  constructor(
    private readonly local: TenantLocalService,
    private readonly audit: AuditService,
  ) {}

  async ensureSchema(companyId: string) {
    await this.local.ensureMdmPartiesSchema(companyId);
    await this.local.ensureMdmCarriersSchema(companyId);
    await this.local.ensureMdmCatalogsSchema(companyId);
    await this.local.ensureMdmBorderSchema(companyId);
    await this.local.ensureMdmOpsSchema(companyId);
  }

  // ── Locations ────────────────────────────────────────────────────
  async listLocations(companyId: string, opts?: { selectableOnly?: boolean }) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Location" WHERE "companyId"=$1
         ORDER BY "name" ASC, "city" ASC`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectPartyStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createLocation(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || body.city || 'Location').trim();
    const line1 = String(body.line1 || '').trim();
    const city = String(body.city || '').trim();
    if (!line1 && !city && !name) {
      throw new BadRequestException('Location needs a name, address, or city');
    }
    const status = canSelectPartyStatus(String(body.status || 'active'))
      ? normalizePartyStatus(String(body.status || 'active'))
      : normalizePartyStatus(String(body.status || 'active'));
    const locStatus =
      status === 'blacklisted' || status === 'watch' || status === 'suspended'
        ? 'inactive'
        : status === 'inactive'
          ? 'inactive'
          : 'active';
    const normalizedKey = buildLocationNormalizedKey({
      line1,
      city,
      region: String(body.region || ''),
      postal: String(body.postal || ''),
      country: String(body.country || 'CA'),
    });
    const duplicates = await this.findLocationDuplicates(
      companyId,
      normalizedKey,
      name,
    );
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `loc_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Location"
          ("id","companyId","name","line1","line2","city","region","postal","country",
           "lat","lon","timeZone","status","normalizedKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          id,
          companyId,
          name,
          line1,
          String(body.line2 || ''),
          city,
          String(body.region || ''),
          String(body.postal || ''),
          String(body.country || 'CA'),
          body.lat != null ? Number(body.lat) : null,
          body.lon != null ? Number(body.lon) : null,
          String(body.timeZone || ''),
          locStatus,
          normalizedKey,
        ],
      );
      const row = (
        await c.query(`SELECT * FROM company_local."Location" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
      return { ...row, duplicateSuggestions: duplicates };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateLocation(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."Location" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException('Location not found');
      const row = existing.rows[0];
      const next = {
        name: body.name !== undefined ? String(body.name) : row.name,
        line1: body.line1 !== undefined ? String(body.line1) : row.line1,
        line2: body.line2 !== undefined ? String(body.line2) : row.line2,
        city: body.city !== undefined ? String(body.city) : row.city,
        region: body.region !== undefined ? String(body.region) : row.region,
        postal: body.postal !== undefined ? String(body.postal) : row.postal,
        country:
          body.country !== undefined ? String(body.country) : row.country,
        timeZone:
          body.timeZone !== undefined ? String(body.timeZone) : row.timeZone,
        status:
          body.status !== undefined
            ? String(body.status) === 'inactive' ||
              String(body.status) === 'archived'
              ? 'inactive'
              : 'active'
            : row.status,
        lat: body.lat !== undefined ? Number(body.lat) : row.lat,
        lon: body.lon !== undefined ? Number(body.lon) : row.lon,
      };
      const normalizedKey = buildLocationNormalizedKey(next);
      await c.query(
        `UPDATE company_local."Location" SET
          "name"=$3,"line1"=$4,"line2"=$5,"city"=$6,"region"=$7,"postal"=$8,
          "country"=$9,"lat"=$10,"lon"=$11,"timeZone"=$12,"status"=$13,
          "normalizedKey"=$14,"updatedAt"=NOW(),
          "archivedAt"=CASE WHEN $13='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [
          id,
          companyId,
          next.name,
          next.line1,
          next.line2,
          next.city,
          next.region,
          next.postal,
          next.country,
          next.lat,
          next.lon,
          next.timeZone,
          next.status,
          normalizedKey,
        ],
      );
      return (
        await c.query(`SELECT * FROM company_local."Location" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Brokers ──────────────────────────────────────────────────────
  async listBrokers(companyId: string, opts?: { selectableOnly?: boolean }) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Broker" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectPartyStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createBroker(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Broker name is required');
    const status = normalizePartyStatus(String(body.status || 'active'));
    const mc = String(body.mc || '').trim();
    const normalizedKey = buildPartyNormalizedKey({
      name,
      mc,
      dot: String(body.dot || ''),
      phone: String(body.phone || ''),
      email: String(body.email || ''),
    });
    const duplicates = await this.findPartyDuplicates(
      companyId,
      'Broker',
      normalizedKey,
      name,
      mc,
      String(body.dot || ''),
      String(body.phone || ''),
    );
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `brk_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Broker"
          ("id","companyId","name","mc","dot","scac","phone","email","website",
           "paymentTerms","rateConfEmail","status","billingLocationId","notes","normalizedKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          companyId,
          name,
          mc,
          String(body.dot || ''),
          String(body.scac || ''),
          String(body.phone || ''),
          String(body.email || ''),
          String(body.website || ''),
          String(body.paymentTerms || ''),
          String(body.rateConfEmail || ''),
          status,
          body.billingLocationId ? String(body.billingLocationId) : null,
          String(body.notes || ''),
          normalizedKey,
        ],
      );
      const row = (
        await c.query(`SELECT * FROM company_local."Broker" WHERE "id"=$1`, [id])
      ).rows[0];
      return { ...row, duplicateSuggestions: duplicates };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateBroker(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    return this.updatePartyRow(companyId, 'Broker', id, body, [
      'name',
      'mc',
      'dot',
      'scac',
      'phone',
      'email',
      'website',
      'paymentTerms',
      'rateConfEmail',
      'status',
      'billingLocationId',
      'notes',
    ]);
  }

  // ── Customers ────────────────────────────────────────────────────
  async listCustomers(companyId: string, opts?: { selectableOnly?: boolean }) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Customer" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectPartyStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createCustomer(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Customer name is required');
    const status = normalizePartyStatus(String(body.status || 'active'));
    const normalizedKey = buildPartyNormalizedKey({
      name,
      phone: String(body.phone || ''),
      email: String(body.email || ''),
    });
    const duplicates = await this.findPartyDuplicates(
      companyId,
      'Customer',
      normalizedKey,
      name,
      '',
      '',
      String(body.phone || ''),
    );
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `cus_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Customer"
          ("id","companyId","name","legalName","dba","phone","email","website",
           "paymentTerms","creditLimit","currency","taxExempt","status",
           "billingLocationId","notes","normalizedKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          id,
          companyId,
          name,
          String(body.legalName || ''),
          String(body.dba || ''),
          String(body.phone || ''),
          String(body.email || ''),
          String(body.website || ''),
          String(body.paymentTerms || ''),
          body.creditLimit != null ? Number(body.creditLimit) : null,
          String(body.currency || 'CAD'),
          Boolean(body.taxExempt),
          status,
          body.billingLocationId ? String(body.billingLocationId) : null,
          String(body.notes || ''),
          normalizedKey,
        ],
      );
      const row = (
        await c.query(`SELECT * FROM company_local."Customer" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
      return { ...row, duplicateSuggestions: duplicates };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateCustomer(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    return this.updatePartyRow(companyId, 'Customer', id, body, [
      'name',
      'legalName',
      'dba',
      'phone',
      'email',
      'website',
      'paymentTerms',
      'currency',
      'status',
      'billingLocationId',
      'notes',
    ]);
  }

  // ── Consignees ───────────────────────────────────────────────────
  async listConsignees(companyId: string, opts?: { selectableOnly?: boolean }) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Consignee" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectPartyStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createConsignee(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Consignee name is required');
    const status = normalizePartyStatus(String(body.status || 'active'));
    const normalizedKey = buildPartyNormalizedKey({
      name,
      phone: String(body.phone || ''),
      email: String(body.email || ''),
    });
    const duplicates = await this.findPartyDuplicates(
      companyId,
      'Consignee',
      normalizedKey,
      name,
      '',
      '',
      String(body.phone || ''),
    );
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `cne_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Consignee"
          ("id","companyId","name","phone","email","contactName","receivingHours",
           "dockNumber","appointmentRequired","liftgateRequired","hazmatAccepted",
           "instructions","status","locationId","notes","normalizedKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          id,
          companyId,
          name,
          String(body.phone || ''),
          String(body.email || ''),
          String(body.contactName || ''),
          String(body.receivingHours || ''),
          String(body.dockNumber || ''),
          Boolean(body.appointmentRequired),
          Boolean(body.liftgateRequired),
          Boolean(body.hazmatAccepted),
          String(body.instructions || ''),
          status,
          body.locationId ? String(body.locationId) : null,
          String(body.notes || ''),
          normalizedKey,
        ],
      );
      const row = (
        await c.query(`SELECT * FROM company_local."Consignee" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
      return { ...row, duplicateSuggestions: duplicates };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateConsignee(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    return this.updatePartyRow(companyId, 'Consignee', id, body, [
      'name',
      'phone',
      'email',
      'contactName',
      'receivingHours',
      'dockNumber',
      'status',
      'locationId',
      'instructions',
      'notes',
    ]);
  }

  // ── Carriers (subcontract; ≠ CarrierProfile) ─────────────────────
  async listCarriers(companyId: string, opts?: { selectableOnly?: boolean }) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Carrier" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectPartyStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createCarrier(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Carrier name is required');
    const status = normalizePartyStatus(String(body.status || 'active'));
    const mc = String(body.mc || '').trim();
    const normalizedKey = buildPartyNormalizedKey({
      name,
      mc,
      dot: String(body.dot || ''),
      phone: String(body.phone || ''),
      email: String(body.email || ''),
    });
    const duplicates = await this.findPartyDuplicates(
      companyId,
      'Carrier',
      normalizedKey,
      name,
      mc,
      String(body.dot || ''),
      String(body.phone || ''),
    );
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `car_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Carrier"
          ("id","companyId","name","mc","dot","scac","phone","email","website",
           "insuranceExpiry","safetyRating","equipmentNotes","status","notes","normalizedKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          companyId,
          name,
          mc,
          String(body.dot || ''),
          String(body.scac || ''),
          String(body.phone || ''),
          String(body.email || ''),
          String(body.website || ''),
          String(body.insuranceExpiry || ''),
          String(body.safetyRating || ''),
          String(body.equipmentNotes || ''),
          status,
          String(body.notes || ''),
          normalizedKey,
        ],
      );
      const row = (
        await c.query(`SELECT * FROM company_local."Carrier" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
      return { ...row, duplicateSuggestions: duplicates };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateCarrier(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    return this.updatePartyRow(companyId, 'Carrier', id, body, [
      'name',
      'mc',
      'dot',
      'scac',
      'phone',
      'email',
      'website',
      'insuranceExpiry',
      'safetyRating',
      'equipmentNotes',
      'status',
      'notes',
    ]);
  }

  // ── Commodities (Phase 4) ────────────────────────────────────────
  async listCommodities(
    companyId: string,
    opts?: { selectableOnly?: boolean },
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."Commodity" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectCatalogStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createCommodity(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Commodity name is required');
    const status = normalizePartyStatus(String(body.status || 'active'));
    const normalizedKey = buildCommodityNormalizedKey(name);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT "id","name","status" FROM company_local."Commodity"
         WHERE "companyId"=$1 AND "normalizedKey"=$2 LIMIT 5`,
        [companyId, normalizedKey],
      );
      const duplicates = existing.rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        reason: 'same name',
      }));
      if (duplicates.length) {
        throw new BadRequestException(
          `Commodity "${name}" already exists — use the existing master or rename`,
        );
      }
      const id = `cmd_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Commodity"
          ("id","companyId","name","nmfc","hazmat","tempMin","tempMax","weightLimit",
           "status","notes","normalizedKey","system")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)`,
        [
          id,
          companyId,
          name,
          String(body.nmfc || ''),
          Boolean(body.hazmat),
          body.tempMin != null && body.tempMin !== ''
            ? Number(body.tempMin)
            : null,
          body.tempMax != null && body.tempMax !== ''
            ? Number(body.tempMax)
            : null,
          body.weightLimit != null && body.weightLimit !== ''
            ? Number(body.weightLimit)
            : null,
          status,
          String(body.notes || ''),
          normalizedKey,
        ],
      );
      const row = (
        await c.query(`SELECT * FROM company_local."Commodity" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
      return { ...row, duplicateSuggestions: duplicates };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateCommodity(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."Commodity" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException('Commodity not found');
      const row = { ...existing.rows[0] };
      if (body.name !== undefined) row.name = String(body.name);
      if (body.nmfc !== undefined) row.nmfc = String(body.nmfc);
      if (body.hazmat !== undefined) row.hazmat = Boolean(body.hazmat);
      if (body.tempMin !== undefined)
        row.tempMin =
          body.tempMin === '' || body.tempMin == null
            ? null
            : Number(body.tempMin);
      if (body.tempMax !== undefined)
        row.tempMax =
          body.tempMax === '' || body.tempMax == null
            ? null
            : Number(body.tempMax);
      if (body.weightLimit !== undefined)
        row.weightLimit =
          body.weightLimit === '' || body.weightLimit == null
            ? null
            : Number(body.weightLimit);
      if (body.status !== undefined)
        row.status = normalizePartyStatus(String(body.status));
      if (body.notes !== undefined) row.notes = String(body.notes);
      row.normalizedKey = buildCommodityNormalizedKey(row.name);
      await c.query(
        `UPDATE company_local."Commodity" SET
          "name"=$3,"nmfc"=$4,"hazmat"=$5,"tempMin"=$6,"tempMax"=$7,"weightLimit"=$8,
          "status"=$9,"notes"=$10,"normalizedKey"=$11,"updatedAt"=NOW(),
          "archivedAt"=CASE WHEN $9='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [
          id,
          companyId,
          row.name,
          row.nmfc,
          row.hazmat,
          row.tempMin,
          row.tempMax,
          row.weightLimit,
          row.status,
          row.notes,
          row.normalizedKey,
        ],
      );
      return (
        await c.query(`SELECT * FROM company_local."Commodity" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Warehouses (Phase 4 — on Locations) ──────────────────────────
  async listWarehouses(
    companyId: string,
    opts?: { selectableOnly?: boolean },
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT w.*,
            l."name" AS "locationName",
            l."city" AS "locationCity",
            l."region" AS "locationRegion"
         FROM company_local."Warehouse" w
         LEFT JOIN company_local."Location" l ON l."id"=w."locationId"
         WHERE w."companyId"=$1
         ORDER BY w."name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter((r) => canSelectCatalogStatus(r.status));
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createWarehouse(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Warehouse name is required');
    const status = normalizePartyStatus(String(body.status || 'active'));
    const locationId = body.locationId ? String(body.locationId) : null;
    if (locationId) {
      const c0 = await this.local.openTenantClient(companyId);
      try {
        const loc = await c0.query(
          `SELECT "id" FROM company_local."Location" WHERE "id"=$1 AND "companyId"=$2`,
          [locationId, companyId],
        );
        if (!loc.rows[0]) throw new BadRequestException('Location not found');
      } finally {
        await c0.end().catch(() => undefined);
      }
    }
    const normalizedKey = buildWarehouseNormalizedKey(name);
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `wh_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."Warehouse"
          ("id","companyId","name","locationId","hours","docks","appointmentRules",
           "phone","status","notes","normalizedKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          id,
          companyId,
          name,
          locationId,
          String(body.hours || ''),
          String(body.docks || ''),
          String(body.appointmentRules || ''),
          String(body.phone || ''),
          status,
          String(body.notes || ''),
          normalizedKey,
        ],
      );
      return (
        await c.query(`SELECT * FROM company_local."Warehouse" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateWarehouse(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."Warehouse" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException('Warehouse not found');
      const row = { ...existing.rows[0] };
      if (body.name !== undefined) row.name = String(body.name);
      if (body.locationId !== undefined)
        row.locationId = body.locationId ? String(body.locationId) : null;
      if (body.hours !== undefined) row.hours = String(body.hours);
      if (body.docks !== undefined) row.docks = String(body.docks);
      if (body.appointmentRules !== undefined)
        row.appointmentRules = String(body.appointmentRules);
      if (body.phone !== undefined) row.phone = String(body.phone);
      if (body.status !== undefined)
        row.status = normalizePartyStatus(String(body.status));
      if (body.notes !== undefined) row.notes = String(body.notes);
      row.normalizedKey = buildWarehouseNormalizedKey(row.name);
      await c.query(
        `UPDATE company_local."Warehouse" SET
          "name"=$3,"locationId"=$4,"hours"=$5,"docks"=$6,"appointmentRules"=$7,
          "phone"=$8,"status"=$9,"notes"=$10,"normalizedKey"=$11,"updatedAt"=NOW(),
          "archivedAt"=CASE WHEN $9='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [
          id,
          companyId,
          row.name,
          row.locationId,
          row.hours,
          row.docks,
          row.appointmentRules,
          row.phone,
          row.status,
          row.notes,
          row.normalizedKey,
        ],
      );
      return (
        await c.query(`SELECT * FROM company_local."Warehouse" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  // ── Border / Ports of Entry (Phase 5) ─────────────────────────────
  async listBorderCrossings(companyId: string) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."BorderCrossing" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      return res.rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async listPortsOfEntry(
    companyId: string,
    opts?: { selectableOnly?: boolean; country?: string },
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."PortOfEntry" WHERE "companyId"=$1
         ORDER BY "country", "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.country) {
        const country = opts.country.toUpperCase();
        rows = rows.filter(
          (r) => String(r.country || '').toUpperCase() === country,
        );
      }
      if (opts?.selectableOnly) {
        rows = rows.filter(
          (r) => String(r.status || '').toLowerCase() === 'active',
        );
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async getPortOfEntry(companyId: string, id: string) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."PortOfEntry" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!res.rows[0]) throw new NotFoundException('Port of entry not found');
      const port = res.rows[0];
      return {
        ...port,
        defaultProgram: defaultProgramForPort(port),
        customsFlags: customsFlagsFromPort(port),
        shipmentTypes: [
          ...(port.pars || port.aci ? ['PARS'] : []),
          ...(port.paps || port.ace ? ['PAPS'] : []),
          'In-Bond',
        ],
      };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  /** Preview customs options for a POE (acceptance #3 populate). */
  async resolvePortCustoms(companyId: string, portId: string) {
    const port = await this.getPortOfEntry(companyId, portId);
    return {
      portOfEntryId: port.id,
      portOfEntryCode: port.code,
      portOfEntryName: port.name,
      country: port.country,
      borderCrossingName: port.borderCrossingName,
      fastLane: Boolean(port.fastLane),
      defaultProgram: port.defaultProgram,
      customsAce: Boolean(port.ace),
      customsAci: Boolean(port.aci),
      customsPaps: Boolean(port.paps),
      customsPars: Boolean(port.pars),
      shipmentTypes: port.shipmentTypes,
      restrictions: port.restrictions || '',
    };
  }

  async updatePortOfEntry(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."PortOfEntry" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException('Port of entry not found');
      const row = existing.rows[0];
      // System ports: allow status / notes / hours / favorites only — not official codes
      const status =
        body.status !== undefined
          ? String(body.status) === 'inactive'
            ? 'inactive'
            : 'active'
          : row.status;
      const notes =
        body.notes !== undefined ? String(body.notes) : row.notes;
      const hours =
        body.hours !== undefined ? String(body.hours) : row.hours;
      await c.query(
        `UPDATE company_local."PortOfEntry" SET
          "status"=$3,"notes"=$4,"hours"=$5,"updatedAt"=NOW(),
          "archivedAt"=CASE WHEN $3='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId, status, notes, hours],
      );
      return this.getPortOfEntry(companyId, id);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  /** Server-side acceptance #3 gate helper for callers. */
  async assertCrossBorderReady(
    companyId: string,
    input: {
      crossBorder: boolean;
      portOfEntryId?: string | null;
      customsProgram?: string | null;
    },
  ) {
    if (!input.crossBorder) return null;
    let port: Record<string, unknown> | null = null;
    if (input.portOfEntryId) {
      try {
        port = await this.getPortOfEntry(companyId, input.portOfEntryId);
      } catch {
        port = null;
      }
    }
    const errors = validateCrossBorderDispatch({
      crossBorder: true,
      portOfEntryId: input.portOfEntryId,
      customsProgram: input.customsProgram,
      port: port
        ? {
            ace: Boolean(port.ace),
            aci: Boolean(port.aci),
            paps: Boolean(port.paps),
            pars: Boolean(port.pars),
            status: String(port.status || ''),
          }
        : null,
    });
    if (errors.length) {
      throw new BadRequestException(errors.join('; '));
    }
    return port;
  }

  // ── Ops / finance refs (Phase 6) ─────────────────────────────────
  async listOpsNamed(
    companyId: string,
    table: string,
    opts?: { selectableOnly?: boolean },
  ) {
    if (!isOpsNamedTable(table)) {
      throw new BadRequestException('Unknown ops catalog');
    }
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."${table}" WHERE "companyId"=$1 ORDER BY "name"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter(
          (r) => String(r.status || '').toLowerCase() === 'active',
        );
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createOpsNamed(
    companyId: string,
    table: string,
    body: Record<string, unknown>,
  ) {
    if (!isOpsNamedTable(table)) {
      throw new BadRequestException('Unknown ops catalog');
    }
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Name is required');
    const status =
      String(body.status || 'active') === 'inactive' ? 'inactive' : 'active';
    const normalizedKey = buildOpsNormalizedKey(name);
    const prefix =
      table === 'MaintenanceVendor'
        ? 'mvn'
        : table === 'FuelStation'
          ? 'fst'
          : 'ins';
    const c = await this.local.openTenantClient(companyId);
    try {
      const dup = await c.query(
        `SELECT "id" FROM company_local."${table}"
         WHERE "companyId"=$1 AND "normalizedKey"=$2 LIMIT 1`,
        [companyId, normalizedKey],
      );
      if (dup.rows[0]) {
        throw new BadRequestException(
          `${table.replace(/([A-Z])/g, ' $1').trim()} "${name}" already exists`,
        );
      }
      const id = `${prefix}_${randomBytes(8).toString('hex')}`;
      if (table === 'FuelStation') {
        await c.query(
          `INSERT INTO company_local."FuelStation"
            ("id","companyId","name","brand","locationId","notes","status","normalizedKey")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            companyId,
            name,
            String(body.brand || ''),
            body.locationId ? String(body.locationId) : null,
            String(body.notes || ''),
            status,
            normalizedKey,
          ],
        );
      } else {
        await c.query(
          `INSERT INTO company_local."${table}"
            ("id","companyId","name","phone","email","notes","status","normalizedKey"
             ${table === 'MaintenanceVendor' ? ',"locationId"' : ''})
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8${table === 'MaintenanceVendor' ? ',$9' : ''})`,
          table === 'MaintenanceVendor'
            ? [
                id,
                companyId,
                name,
                String(body.phone || ''),
                String(body.email || ''),
                String(body.notes || ''),
                status,
                normalizedKey,
                body.locationId ? String(body.locationId) : null,
              ]
            : [
                id,
                companyId,
                name,
                String(body.phone || ''),
                String(body.email || ''),
                String(body.notes || ''),
                status,
                normalizedKey,
              ],
        );
      }
      return (
        await c.query(`SELECT * FROM company_local."${table}" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateOpsNamed(
    companyId: string,
    table: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    if (!isOpsNamedTable(table)) {
      throw new BadRequestException('Unknown ops catalog');
    }
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."${table}" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException(`${table} not found`);
      const row = { ...existing.rows[0] };
      if (body.name !== undefined) row.name = String(body.name);
      if (body.phone !== undefined) row.phone = String(body.phone);
      if (body.email !== undefined) row.email = String(body.email);
      if (body.brand !== undefined) row.brand = String(body.brand);
      if (body.notes !== undefined) row.notes = String(body.notes);
      if (body.locationId !== undefined)
        row.locationId = body.locationId ? String(body.locationId) : null;
      if (body.status !== undefined)
        row.status =
          String(body.status) === 'inactive' ? 'inactive' : 'active';
      row.normalizedKey = buildOpsNormalizedKey(String(row.name));
      if (table === 'FuelStation') {
        await c.query(
          `UPDATE company_local."FuelStation" SET
            "name"=$3,"brand"=$4,"locationId"=$5,"notes"=$6,"status"=$7,
            "normalizedKey"=$8,"updatedAt"=NOW(),
            "archivedAt"=CASE WHEN $7='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
           WHERE "id"=$1 AND "companyId"=$2`,
          [
            id,
            companyId,
            row.name,
            row.brand || '',
            row.locationId || null,
            row.notes || '',
            row.status,
            row.normalizedKey,
          ],
        );
      } else if (table === 'MaintenanceVendor') {
        await c.query(
          `UPDATE company_local."MaintenanceVendor" SET
            "name"=$3,"phone"=$4,"email"=$5,"locationId"=$6,"notes"=$7,"status"=$8,
            "normalizedKey"=$9,"updatedAt"=NOW(),
            "archivedAt"=CASE WHEN $8='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
           WHERE "id"=$1 AND "companyId"=$2`,
          [
            id,
            companyId,
            row.name,
            row.phone || '',
            row.email || '',
            row.locationId || null,
            row.notes || '',
            row.status,
            row.normalizedKey,
          ],
        );
      } else {
        await c.query(
          `UPDATE company_local."InsuranceProvider" SET
            "name"=$3,"phone"=$4,"email"=$5,"notes"=$6,"status"=$7,
            "normalizedKey"=$8,"updatedAt"=NOW(),
            "archivedAt"=CASE WHEN $7='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
           WHERE "id"=$1 AND "companyId"=$2`,
          [
            id,
            companyId,
            row.name,
            row.phone || '',
            row.email || '',
            row.notes || '',
            row.status,
            row.normalizedKey,
          ],
        );
      }
      return (
        await c.query(`SELECT * FROM company_local."${table}" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async listOpsCoded(
    companyId: string,
    table: string,
    opts?: { selectableOnly?: boolean },
  ) {
    if (!isOpsCodedTable(table)) {
      throw new BadRequestException('Unknown coded catalog');
    }
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."${table}" WHERE "companyId"=$1 ORDER BY "code"`,
        [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter(
          (r) => String(r.status || '').toLowerCase() === 'active',
        );
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createOpsCoded(
    companyId: string,
    table: string,
    body: Record<string, unknown>,
  ) {
    if (!isOpsCodedTable(table)) {
      throw new BadRequestException('Unknown coded catalog');
    }
    await this.ensureSchema(companyId);
    const name = String(body.name || '').trim();
    const code = slugOpsCode(String(body.code || name));
    if (!name || !code) {
      throw new BadRequestException('Code and name are required');
    }
    const status =
      String(body.status || 'active') === 'inactive' ? 'inactive' : 'active';
    const prefix = table === 'CostCenter' ? 'cc' : 'pay';
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `${prefix}_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."${table}"
          ("id","companyId","code","name","notes","status")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, companyId, code, name, String(body.notes || ''), status],
      );
      return (
        await c.query(`SELECT * FROM company_local."${table}" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateOpsCoded(
    companyId: string,
    table: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    if (!isOpsCodedTable(table)) {
      throw new BadRequestException('Unknown coded catalog');
    }
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."${table}" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException(`${table} not found`);
      const row = { ...existing.rows[0] };
      if (body.name !== undefined) row.name = String(body.name);
      if (body.code !== undefined) row.code = slugOpsCode(String(body.code));
      if (body.notes !== undefined) row.notes = String(body.notes);
      if (body.status !== undefined)
        row.status =
          String(body.status) === 'inactive' ? 'inactive' : 'active';
      await c.query(
        `UPDATE company_local."${table}" SET
          "code"=$3,"name"=$4,"notes"=$5,"status"=$6,"updatedAt"=NOW(),
          "archivedAt"=CASE WHEN $6='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId, row.code, row.name, row.notes || '', row.status],
      );
      return (
        await c.query(`SELECT * FROM company_local."${table}" WHERE "id"=$1`, [
          id,
        ])
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async listReferenceData(
    companyId: string,
    opts?: { kind?: string; selectableOnly?: boolean },
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."ReferenceData" WHERE "companyId"=$1
         ${opts?.kind ? 'AND "kind"=$2' : ''}
         ORDER BY "kind","code"`,
        opts?.kind ? [companyId, opts.kind] : [companyId],
      );
      let rows = res.rows;
      if (opts?.selectableOnly) {
        rows = rows.filter(
          (r) => String(r.status || '').toLowerCase() === 'active',
        );
      }
      return rows;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async createReferenceData(companyId: string, body: Record<string, unknown>) {
    await this.ensureSchema(companyId);
    const kind = slugOpsCode(String(body.kind || 'CUSTOM')).toLowerCase();
    const name = String(body.name || '').trim();
    const code = slugOpsCode(String(body.code || name));
    if (!kind || !name || !code) {
      throw new BadRequestException('kind, code, and name are required');
    }
    const status =
      String(body.status || 'active') === 'inactive' ? 'inactive' : 'active';
    const c = await this.local.openTenantClient(companyId);
    try {
      const id = `ref_${randomBytes(8).toString('hex')}`;
      await c.query(
        `INSERT INTO company_local."ReferenceData"
          ("id","companyId","kind","code","name","notes","status")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, companyId, kind, code, name, String(body.notes || ''), status],
      );
      return (
        await c.query(
          `SELECT * FROM company_local."ReferenceData" WHERE "id"=$1`,
          [id],
        )
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async updateReferenceData(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."ReferenceData" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0])
        throw new NotFoundException('Reference data not found');
      const row = { ...existing.rows[0] };
      if (body.name !== undefined) row.name = String(body.name);
      if (body.code !== undefined) row.code = slugOpsCode(String(body.code));
      if (body.kind !== undefined)
        row.kind = slugOpsCode(String(body.kind)).toLowerCase();
      if (body.notes !== undefined) row.notes = String(body.notes);
      if (body.status !== undefined)
        row.status =
          String(body.status) === 'inactive' ? 'inactive' : 'active';
      await c.query(
        `UPDATE company_local."ReferenceData" SET
          "kind"=$3,"code"=$4,"name"=$5,"notes"=$6,"status"=$7,"updatedAt"=NOW(),
          "archivedAt"=CASE WHEN $7='inactive' THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [
          id,
          companyId,
          row.kind,
          row.code,
          row.name,
          row.notes || '',
          row.status,
        ],
      );
      return (
        await c.query(
          `SELECT * FROM company_local."ReferenceData" WHERE "id"=$1`,
          [id],
        )
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  /**
   * Explicit admin merge: reassign FKs to survivor, fill blank fields, soft-archive absorb.
   * Never silent — caller must confirm in UI.
   */
  async mergeParties(
    companyId: string,
    body: {
      entityType: string;
      survivorId: string;
      absorbId: string;
    },
    actor?: AuditActor,
  ) {
    await this.ensureSchema(companyId);
    const entityType = String(body.entityType || '');
    if (!isMdmMergeEntity(entityType)) {
      throw new BadRequestException(
        `entityType must be one of Broker, Customer, Consignee, Carrier, Location`,
      );
    }
    const survivorId = String(body.survivorId || '');
    const absorbId = String(body.absorbId || '');
    if (!survivorId || !absorbId) {
      throw new BadRequestException('survivorId and absorbId are required');
    }
    if (survivorId === absorbId) {
      throw new BadRequestException('Cannot merge a record into itself');
    }

    const c = await this.local.openTenantClient(companyId);
    try {
      const survRes = await c.query(
        `SELECT * FROM company_local."${entityType}" WHERE "id"=$1 AND "companyId"=$2`,
        [survivorId, companyId],
      );
      const absRes = await c.query(
        `SELECT * FROM company_local."${entityType}" WHERE "id"=$1 AND "companyId"=$2`,
        [absorbId, companyId],
      );
      const survivor = survRes.rows[0];
      const absorb = absRes.rows[0];
      if (!survivor || !absorb) {
        throw new NotFoundException(`${entityType} not found`);
      }

      const fillFields =
        entityType === 'Location'
          ? [
              'name',
              'line1',
              'line2',
              'city',
              'region',
              'postal',
              'country',
              'timeZone',
            ]
          : entityType === 'Carrier'
            ? [
                'mc',
                'dot',
                'scac',
                'phone',
                'email',
                'website',
                'insuranceExpiry',
                'safetyRating',
                'equipmentNotes',
                'notes',
              ]
            : entityType === 'Broker'
              ? [
                  'mc',
                  'dot',
                  'scac',
                  'phone',
                  'email',
                  'website',
                  'paymentTerms',
                  'rateConfEmail',
                  'notes',
                ]
              : entityType === 'Customer'
                ? [
                    'legalName',
                    'dba',
                    'phone',
                    'email',
                    'website',
                    'paymentTerms',
                    'currency',
                    'notes',
                  ]
                : [
                    'phone',
                    'email',
                    'contactName',
                    'receivingHours',
                    'dockNumber',
                    'instructions',
                    'notes',
                  ];

      const merged = mergePartyFields(survivor, absorb, fillFields);
      if (entityType === 'Location') {
        merged.normalizedKey = buildLocationNormalizedKey({
          line1: String(merged.line1 || ''),
          city: String(merged.city || ''),
          region: String(merged.region || ''),
          postal: String(merged.postal || ''),
          country: String(merged.country || 'CA'),
        });
        await c.query(
          `UPDATE company_local."Location" SET
            "name"=$3,"line1"=$4,"line2"=$5,"city"=$6,"region"=$7,"postal"=$8,
            "country"=$9,"timeZone"=$10,"normalizedKey"=$11,"updatedAt"=NOW()
           WHERE "id"=$1 AND "companyId"=$2`,
          [
            survivorId,
            companyId,
            merged.name,
            merged.line1,
            merged.line2,
            merged.city,
            merged.region,
            merged.postal,
            merged.country,
            merged.timeZone,
            merged.normalizedKey,
          ],
        );
        await c.query(
          `UPDATE fleet."Load" SET "originLocationId"=$1
           WHERE "companyId"=$2 AND "originLocationId"=$3`,
          [survivorId, companyId, absorbId],
        );
        await c.query(
          `UPDATE fleet."Load" SET "destinationLocationId"=$1
           WHERE "companyId"=$2 AND "destinationLocationId"=$3`,
          [survivorId, companyId, absorbId],
        );
        await c.query(
          `UPDATE company_local."Broker" SET "billingLocationId"=$1
           WHERE "companyId"=$2 AND "billingLocationId"=$3`,
          [survivorId, companyId, absorbId],
        );
        await c.query(
          `UPDATE company_local."Customer" SET "billingLocationId"=$1
           WHERE "companyId"=$2 AND "billingLocationId"=$3`,
          [survivorId, companyId, absorbId],
        );
        await c.query(
          `UPDATE company_local."Consignee" SET "locationId"=$1
           WHERE "companyId"=$2 AND "locationId"=$3`,
          [survivorId, companyId, absorbId],
        );
      } else {
        merged.normalizedKey = buildPartyNormalizedKey({
          name: String(merged.name || survivor.name),
          mc: String(merged.mc || ''),
          dot: String(merged.dot || ''),
          phone: String(merged.phone || ''),
          email: String(merged.email || ''),
        });
        const cols = [...fillFields, 'normalizedKey'];
        const sets = cols.map((f, i) => `"${f}"=$${i + 3}`).join(', ');
        await c.query(
          `UPDATE company_local."${entityType}" SET ${sets}, "updatedAt"=NOW()
           WHERE "id"=$1 AND "companyId"=$2`,
          [survivorId, companyId, ...cols.map((f) => merged[f])],
        );

        const fk = fleetFkColumnForEntity(entityType as MdmMergeEntity);
        if (fk) {
          if (fk.nameColumn) {
            await c.query(
              `UPDATE fleet."Load" SET "${fk.column}"=$1, "${fk.nameColumn}"=$2
               WHERE "companyId"=$3 AND "${fk.column}"=$4`,
              [
                survivorId,
                String(survivor.name || ''),
                companyId,
                absorbId,
              ],
            );
          } else {
            await c.query(
              `UPDATE fleet."Load" SET "${fk.column}"=$1
               WHERE "companyId"=$2 AND "${fk.column}"=$3`,
              [survivorId, companyId, absorbId],
            );
          }
        }
        if (entityType === 'Customer') {
          await c.query(
            `UPDATE accounting."Invoice" SET "customerId"=$1
             WHERE "companyId"=$2 AND "customerId"=$3`,
            [survivorId, companyId, absorbId],
          );
        }
      }

      await c.query(
        `UPDATE company_local."${entityType}" SET
          "status"='inactive', "archivedAt"=COALESCE("archivedAt", NOW()), "updatedAt"=NOW()
         WHERE "id"=$1 AND "companyId"=$2`,
        [absorbId, companyId],
      );

      await this.audit.create({
        companyId,
        actorId: actor?.id,
        actorName: actor?.name,
        action: 'mdm.merge',
        entityType,
        entityId: survivorId,
        meta: {
          absorbId,
          absorbName: absorb.name,
          survivorName: survivor.name,
        },
        before: { absorbId, survivorId },
        after: { survivorId, absorbStatus: 'inactive' },
      });

      const kept = (
        await c.query(
          `SELECT * FROM company_local."${entityType}" WHERE "id"=$1`,
          [survivorId],
        )
      ).rows[0];
      return {
        survivor: kept,
        absorbedId: absorbId,
        entityType,
      };
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  /** Assert a party may be used on a new dispatch/invoice. */
  async assertSelectable(
    companyId: string,
    kind: 'Broker' | 'Customer' | 'Consignee' | 'Carrier' | 'Location',
    id: string,
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT * FROM company_local."${kind}" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundException(`${kind} not found`);
      if (!canSelectPartyStatus(row.status)) {
        throw new BadRequestException(
          partySelectBlockReason(kind, row.name || id, row.status),
        );
      }
      return row;
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async exportCsv(companyId: string, entityRaw: string) {
    await this.ensureSchema(companyId);
    const entity = String(entityRaw || '').toLowerCase();
    if (!isMdmIoEntity(entity)) {
      throw new BadRequestException(
        'entity must be brokers, customers, locations, or commodities',
      );
    }
    const cols = MDM_IO_COLUMNS[entity];
    const rows = await this.listForIo(companyId, entity);
    const csv = toCsv(
      cols,
      rows.map((r) => this.rowToCsvRecord(entity, r)),
    );
    return { entity, filename: filenameForEntity(entity), csv };
  }

  async importCsv(
    companyId: string,
    body: Record<string, unknown>,
    actor?: AuditActor,
  ) {
    await this.ensureSchema(companyId);
    const entity = String(body.entity || '').toLowerCase();
    if (!isMdmIoEntity(entity)) {
      throw new BadRequestException(
        'entity must be brokers, customers, locations, or commodities',
      );
    }
    const dryFlag = body.dryRun ?? body.dry_run;
    const dryRun = !(
      dryFlag === false ||
      dryFlag === 0 ||
      dryFlag === '0' ||
      dryFlag === 'false'
    );
    const csvText = String(body.csv || '');
    if (!csvText.trim()) throw new BadRequestException('csv is required');
    const parsed = parseCsv(csvText);
    if (!parsed.headers.length) {
      throw new BadRequestException('CSV has no header row');
    }
    const MAX = 2000;
    if (parsed.rows.length > MAX) {
      throw new BadRequestException(`CSV exceeds ${MAX} data rows`);
    }

    const errors: CsvRowError[] = [];
    const valid: Array<{
      row: number;
      body: Record<string, unknown>;
      key: string;
      name: string;
    }> = [];
    parsed.rows.forEach((raw, i) => {
      const rowNum = i + 2;
      const res = validateIoRow(entity, raw, rowNum);
      errors.push(...res.errors);
      if (res.ok) valid.push(res.ok);
    });

    const existing = await this.existingIoKeys(companyId, entity);
    const seen = new Set<string>();
    const toCreate: typeof valid = [];
    let skipped = 0;
    for (const item of valid) {
      if (existing.has(item.key) || seen.has(item.key)) {
        skipped += 1;
        continue;
      }
      seen.add(item.key);
      toCreate.push(item);
    }

    const preview = toCreate.slice(0, 8).map((r) => r.name);

    if (dryRun) {
      return {
        dryRun: true,
        entity,
        created: 0,
        wouldCreate: toCreate.length,
        skipped,
        errorCount: errors.length,
        errors: errors.slice(0, 200),
        preview,
      };
    }

    let created = 0;
    for (const item of toCreate) {
      try {
        await this.createFromIo(companyId, entity, item.body);
        created += 1;
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Create failed';
        errors.push({ row: item.row, field: 'name', message });
      }
    }

    await this.audit.create({
      companyId,
      actorId: actor?.id,
      actorName: actor?.name,
      action: 'mdm.import',
      entityType: entity,
      entityId: companyId,
      meta: { created, skipped, errorCount: errors.length },
      after: { created, skipped },
    });

    return {
      dryRun: false,
      entity,
      created,
      wouldCreate: created,
      skipped,
      errorCount: errors.length,
      errors: errors.slice(0, 200),
      preview,
    };
  }

  private async listForIo(companyId: string, entity: MdmIoEntity) {
    if (entity === 'brokers') return this.listBrokers(companyId);
    if (entity === 'customers') return this.listCustomers(companyId);
    if (entity === 'locations') return this.listLocations(companyId);
    return this.listCommodities(companyId);
  }

  private rowToCsvRecord(
    entity: MdmIoEntity,
    r: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const col of MDM_IO_COLUMNS[entity]) {
      const v = r[col];
      if (col === 'hazmat' || col === 'taxExempt') {
        out[col] = v === true || v === 'true' || v === 't' ? 'true' : 'false';
      } else {
        out[col] = v == null ? '' : v;
      }
    }
    return out;
  }

  private async existingIoKeys(
    companyId: string,
    entity: MdmIoEntity,
  ): Promise<Set<string>> {
    const table =
      entity === 'brokers'
        ? 'Broker'
        : entity === 'customers'
          ? 'Customer'
          : entity === 'locations'
            ? 'Location'
            : 'Commodity';
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT "normalizedKey" FROM company_local."${table}" WHERE "companyId"=$1`,
        [companyId],
      );
      return new Set(
        res.rows
          .map((row) => String(row.normalizedKey || ''))
          .filter(Boolean),
      );
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  private createFromIo(
    companyId: string,
    entity: MdmIoEntity,
    body: Record<string, unknown>,
  ) {
    if (entity === 'brokers') return this.createBroker(companyId, body);
    if (entity === 'customers') return this.createCustomer(companyId, body);
    if (entity === 'locations') return this.createLocation(companyId, body);
    return this.createCommodity(companyId, body);
  }

  private async updatePartyRow(
    companyId: string,
    table: 'Broker' | 'Customer' | 'Consignee' | 'Carrier',
    id: string,
    body: Record<string, unknown>,
    fields: string[],
  ) {
    await this.ensureSchema(companyId);
    const c = await this.local.openTenantClient(companyId);
    try {
      const existing = await c.query(
        `SELECT * FROM company_local."${table}" WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId],
      );
      if (!existing.rows[0]) throw new NotFoundException(`${table} not found`);
      const row = { ...existing.rows[0] };
      for (const f of fields) {
        if (body[f] !== undefined) {
          if (f === 'status') {
            row[f] = normalizePartyStatus(String(body[f]));
          } else if (
            f === 'appointmentRequired' ||
            f === 'liftgateRequired' ||
            f === 'hazmatAccepted' ||
            f === 'taxExempt'
          ) {
            row[f] = Boolean(body[f]);
          } else if (f === 'creditLimit') {
            row[f] = body[f] != null ? Number(body[f]) : null;
          } else if (f === 'billingLocationId' || f === 'locationId') {
            row[f] = body[f] ? String(body[f]) : null;
          } else {
            row[f] = String(body[f] ?? '');
          }
        }
      }
      row.normalizedKey = buildPartyNormalizedKey({
        name: row.name,
        mc: row.mc,
        dot: row.dot,
        phone: row.phone,
        email: row.email,
      });
      const cols = [...fields, 'normalizedKey'];
      const sets = cols.map((f, i) => `"${f}"=$${i + 3}`).join(', ');
      const vals = cols.map((f) => row[f]);
      await c.query(
        `UPDATE company_local."${table}" SET ${sets}, "updatedAt"=NOW(),
          "archivedAt"=CASE WHEN "status" IN ('inactive','blacklisted','suspended')
            THEN COALESCE("archivedAt", NOW()) ELSE NULL END
         WHERE "id"=$1 AND "companyId"=$2`,
        [id, companyId, ...vals],
      );
      return (
        await c.query(
          `SELECT * FROM company_local."${table}" WHERE "id"=$1`,
          [id],
        )
      ).rows[0];
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  private async findPartyDuplicates(
    companyId: string,
    table: 'Broker' | 'Customer' | 'Consignee' | 'Carrier',
    normalizedKey: string,
    name: string,
    mc: string,
    dot: string,
    phone: string,
  ): Promise<DupHit[]> {
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT "id","name","status","mc","dot","phone","normalizedKey"
         FROM company_local."${table}" WHERE "companyId"=$1 LIMIT 200`,
        [companyId],
      );
      const hits: DupHit[] = [];
      for (const r of res.rows) {
        let reason = '';
        if (normalizedKey && r.normalizedKey === normalizedKey) {
          reason = 'same key';
        } else if (mc && String(r.mc || '').replace(/\W/g, '') === mc.replace(/\W/g, '')) {
          reason = 'same MC';
        } else if (dot && String(r.dot || '').replace(/\W/g, '') === dot.replace(/\W/g, '')) {
          reason = 'same DOT';
        } else if (
          phone &&
          String(r.phone || '').replace(/\D/g, '') === phone.replace(/\D/g, '') &&
          phone.replace(/\D/g, '').length >= 7
        ) {
          reason = 'same phone';
        } else if (namesLikelyDuplicate(name, r.name)) {
          reason = 'similar name';
        }
        if (reason) {
          hits.push({
            id: r.id,
            name: r.name,
            status: r.status,
            reason,
          });
        }
      }
      return hits.slice(0, 5);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  private async findLocationDuplicates(
    companyId: string,
    normalizedKey: string,
    name: string,
  ): Promise<DupHit[]> {
    const c = await this.local.openTenantClient(companyId);
    try {
      const res = await c.query(
        `SELECT "id","name","status","normalizedKey" FROM company_local."Location"
         WHERE "companyId"=$1 LIMIT 200`,
        [companyId],
      );
      return res.rows
        .filter(
          (r) =>
            (normalizedKey && r.normalizedKey === normalizedKey) ||
            namesLikelyDuplicate(name, r.name),
        )
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          reason:
            r.normalizedKey === normalizedKey
              ? 'same address key'
              : 'similar name',
        }));
    } finally {
      await c.end().catch(() => undefined);
    }
  }
}
