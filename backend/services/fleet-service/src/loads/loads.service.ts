import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getTenantStore, TENANT_HEADERS, tenantAls, type TenantStore } from '@tripsheet/tenant-runtime';
import { PrismaService } from '../prisma/prisma.service';
import {
  assetAssignmentBlockReason,
  canAssignAssetStatus,
} from '../assets/asset-status';
import { ActiveLoadsDto } from './dto/active-loads.dto';
import { CreateLoadDto } from './dto/create-load.dto';
import { ListLoadsDto } from './dto/list-loads.dto';
import { UpdateLoadDto } from './dto/update-load.dto';
import { UpdateLoadStatusDto } from './dto/update-load-status.dto';
import { nextSequenceFromValues, SEQUENCE_PREFIX } from '@tripsheet/shared';
import { validateCrossBorderLoadFields } from './cross-border';

const ACTIVE_STATUSES = ['assigned', 'in_transit'] as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class LoadsService {
  private readonly logger = new Logger(LoadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  findAll(query: ListLoadsDto) {
    const driverWhere = this.driverIdFilter(query.driverId);
    return this.prisma.load.findMany({
      where: {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...driverWhere,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Match loads by driver record id or legacy auth user id on the same driver. */
  private driverIdFilter(driverId?: string) {
    if (!driverId) return {};
    if (driverId === '___no_driver___') {
      return { driverId: '___no_driver___' };
    }
    const store = getTenantStore();
    const ids = new Set<string>([driverId]);
    if (store?.userId) ids.add(store.userId);
    if (ids.size === 1) return { driverId };
    return { driverId: { in: [...ids] } };
  }

  findActive(query: ActiveLoadsDto) {
    return this.prisma.load.findMany({
      where: {
        status: 'in_transit',
        ...(query.companyId ? { companyId: query.companyId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.ensureExists(id);
  }

  async create(dto: CreateLoadDto) {
    if (!dto.driverId?.trim() || !dto.origin?.trim() || !dto.destination?.trim()) {
      throw new BadRequestException(
        'driverId, origin, and destination are required',
      );
    }

    dto.driverId = await this.resolveDriverRecordId(
      dto.driverId.trim(),
      dto.companyId,
    );

    await this.assertNoActiveLoad(dto.driverId);
    await this.assertDriverAssignable(dto.driverId, dto.companyId);
    await this.assertAssetsAssignable({
      companyId: dto.companyId,
      truckId: dto.truckId,
      trailerId: dto.trailerId,
    });
    this.assertCrossBorderReady(dto);
    if (Boolean(dto.crossBorder)) {
      await this.assertDriverBorderEligible(dto.driverId, dto.companyId);
    }

    const status = dto.status ?? 'assigned';
    if (status !== 'assigned' && status !== 'in_transit') {
      throw new BadRequestException(
        'New loads must start as assigned or in_transit',
      );
    }

    const tripNo = await this.allocateLoadTripNo(dto.companyId);
    try {
      const load = await this.prisma.load.create({
      data: {
        companyId: dto.companyId,
        driverId: dto.driverId,
        truckId: dto.truckId,
        trailerId: dto.trailerId,
        status,
        origin: dto.origin,
        destination: dto.destination,
        pickupTime: dto.pickupTime,
        eta: dto.eta,
        actualDelivery: dto.actualDelivery,
        tripNo,
        notes: dto.notes,
        truckNo: dto.truckNo,
        trailerNo: dto.trailerNo,
        customerRate: dto.customerRate ?? 0,
        carrierCost: dto.carrierCost ?? 0,
        fuelSurcharge: dto.fuelSurcharge ?? 0,
        accessorials: dto.accessorials ?? 0,
        detentionHours: dto.detentionHours ?? 0,
        detentionRate: dto.detentionRate ?? 0,
        miles: dto.miles ?? 0,
        stops: (dto.stops as object) ?? [],
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed,
        heading: dto.heading,
        lastUpdate: dto.lastUpdate,
        brokerId: dto.brokerId,
        customerId: dto.customerId,
        originLocationId: dto.originLocationId,
        destinationLocationId: dto.destinationLocationId,
        brokerName: dto.brokerName,
        carrierId: dto.carrierId,
        carrierName: dto.carrierName,
        commodityId: dto.commodityId,
        commodityName: dto.commodityName,
        crossBorder: Boolean(dto.crossBorder),
        portOfEntryId: dto.portOfEntryId,
        portOfEntryCode: dto.portOfEntryCode,
        portOfEntryName: dto.portOfEntryName,
        customsProgram: dto.customsProgram
          ? String(dto.customsProgram).toUpperCase()
          : null,
        customsAce: Boolean(dto.customsAce),
        customsAci: Boolean(dto.customsAci),
        customsPaps: Boolean(dto.customsPaps),
        customsPars: Boolean(dto.customsPars),
      },
    });
      try {
        await this.notifyDriverLoadAssigned(load);
      } catch (e) {
        this.logger.warn(`load assigned notify failed: ${String(e)}`);
      }
      return load;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Trip number ${tripNo} already exists for this company`,
        );
      }
      throw err;
    }
  }

  private async allocateLoadTripNo(companyId: string): Promise<string> {
    const rows = await this.prisma.load.findMany({
      where: { companyId },
      select: { tripNo: true },
    });
    return nextSequenceFromValues(
      rows.map((r) => r.tripNo),
      SEQUENCE_PREFIX.loadTrip,
    );
  }

  async update(id: string, dto: UpdateLoadDto) {
    const existing = await this.ensureExists(id);

    if (dto.status !== undefined && dto.status !== existing.status) {
      this.assertTransition(existing.status, dto.status);
    }

    const nextStatus = (dto.status ?? existing.status) as string;
    const isActive = ACTIVE_STATUSES.includes(
      nextStatus as (typeof ACTIVE_STATUSES)[number],
    );

    if (dto.driverId !== undefined) {
      dto.driverId = await this.resolveDriverRecordId(
        dto.driverId.trim(),
        existing.companyId,
      );
    }

    if (
      dto.driverId !== undefined &&
      dto.driverId !== existing.driverId &&
      isActive
    ) {
      await this.assertNoActiveLoad(dto.driverId, id);
      await this.assertDriverAssignable(
        dto.driverId,
        existing.companyId,
      );
    }

    if (isActive) {
      if (dto.truckId !== undefined || dto.trailerId !== undefined) {
        await this.assertAssetsAssignable({
          companyId: existing.companyId,
          truckId: dto.truckId !== undefined ? dto.truckId : null,
          trailerId: dto.trailerId !== undefined ? dto.trailerId : null,
        });
      }
    }

    this.assertCrossBorderReady({
      crossBorder:
        dto.crossBorder !== undefined
          ? Boolean(dto.crossBorder)
          : Boolean(existing.crossBorder),
      portOfEntryId:
        dto.portOfEntryId !== undefined
          ? dto.portOfEntryId
          : existing.portOfEntryId,
      customsProgram:
        dto.customsProgram !== undefined
          ? dto.customsProgram
          : existing.customsProgram,
      customsAce:
        dto.customsAce !== undefined
          ? Boolean(dto.customsAce)
          : Boolean(existing.customsAce),
      customsAci:
        dto.customsAci !== undefined
          ? Boolean(dto.customsAci)
          : Boolean(existing.customsAci),
      customsPaps:
        dto.customsPaps !== undefined
          ? Boolean(dto.customsPaps)
          : Boolean(existing.customsPaps),
      customsPars:
        dto.customsPars !== undefined
          ? Boolean(dto.customsPars)
          : Boolean(existing.customsPars),
    });

    const crossBorder =
      dto.crossBorder !== undefined
        ? Boolean(dto.crossBorder)
        : Boolean(existing.crossBorder);
    const driverId = dto.driverId ?? existing.driverId;
    if (crossBorder && driverId) {
      await this.assertDriverBorderEligible(driverId, existing.companyId);
    }

    const updated = await this.prisma.load.update({
      where: { id },
      data: {
        driverId: dto.driverId,
        truckId: dto.truckId,
        trailerId: dto.trailerId,
        origin: dto.origin,
        destination: dto.destination,
        pickupTime: dto.pickupTime,
        eta: dto.eta,
        actualDelivery: dto.actualDelivery,
        notes: dto.notes,
        truckNo: dto.truckNo,
        trailerNo: dto.trailerNo,
        customerRate: dto.customerRate,
        carrierCost: dto.carrierCost,
        fuelSurcharge: dto.fuelSurcharge,
        accessorials: dto.accessorials,
        detentionHours: dto.detentionHours,
        detentionRate: dto.detentionRate,
        miles: dto.miles,
        stops: dto.stops !== undefined ? (dto.stops as object) : undefined,
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed,
        heading: dto.heading,
        lastUpdate: dto.lastUpdate,
        status: dto.status,
        brokerId: dto.brokerId,
        customerId: dto.customerId,
        originLocationId: dto.originLocationId,
        destinationLocationId: dto.destinationLocationId,
        brokerName: dto.brokerName,
        carrierId: dto.carrierId,
        carrierName: dto.carrierName,
        commodityId: dto.commodityId,
        commodityName: dto.commodityName,
        crossBorder: dto.crossBorder,
        portOfEntryId: dto.portOfEntryId,
        portOfEntryCode: dto.portOfEntryCode,
        portOfEntryName: dto.portOfEntryName,
        customsProgram:
          dto.customsProgram !== undefined
            ? dto.customsProgram
              ? String(dto.customsProgram).toUpperCase()
              : null
            : undefined,
        customsAce: dto.customsAce,
        customsAci: dto.customsAci,
        customsPaps: dto.customsPaps,
        customsPars: dto.customsPars,
      },
    });
    const driverChanged =
      dto.driverId !== undefined &&
      dto.driverId !== existing.driverId &&
      updated.driverId &&
      ACTIVE_STATUSES.includes(
        updated.status as (typeof ACTIVE_STATUSES)[number],
      );
    if (driverChanged) {
      try {
        await this.notifyDriverLoadAssigned(updated);
      } catch (e) {
        this.logger.warn(`load reassigned notify failed: ${String(e)}`);
      }
    }
    return updated;
  }

  async updateStatus(id: string, dto: UpdateLoadStatusDto) {
    const existing = await this.ensureExists(id);
    this.assertTransition(existing.status, dto.status);

    const updated = await this.prisma.load.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'delivered'
          ? { actualDelivery: new Date().toISOString() }
          : {}),
      },
    });

    const alsStore = getTenantStore();

    if (dto.status === 'in_transit' && existing.status === 'assigned') {
      const actorIsDriver = alsStore?.role === 'driver';
      if (actorIsDriver) {
        this.voidNotifyWithTenant(alsStore, () =>
          this.notifyCompanyStaffTripStarted(updated),
        'trip started notify (→ company)');
      } else {
        this.voidNotifyWithTenant(alsStore, () =>
          this.notifyDriverTripStartedByDispatch(updated),
        'trip started notify (→ driver)');
      }
    }

    if (dto.status === 'delivered' && existing.status === 'in_transit') {
      const actorIsDriver = alsStore?.role === 'driver';
      if (actorIsDriver) {
        this.voidNotifyWithTenant(alsStore, () =>
          this.notifyCompanyStaffTripDelivered(updated),
        'trip delivered notify (→ company)');
      } else {
        this.voidNotifyWithTenant(alsStore, () =>
          this.notifyDriverTripDeliveredByDispatch(updated),
        'trip delivered notify (→ driver)');
      }
    }

    if (
      dto.status === 'cancelled' &&
      updated.driverId &&
      (existing.status === 'assigned' || existing.status === 'in_transit') &&
      alsStore?.role !== 'driver'
    ) {
      this.voidNotifyWithTenant(alsStore, () =>
        this.notifyDriverTripCancelledByDispatch(updated),
      'trip cancelled notify (→ driver)');
    }

    return updated;
  }

  async simulateTrack(id: string) {
    const load = await this.ensureExists(id);
    if (load.status !== 'in_transit') {
      throw new BadRequestException(
        'simulate-track is only allowed for in_transit loads',
      );
    }

    const lat = (load.lat ?? 51.05) + (Math.random() * 0.2 - 0.05);
    const lng = (load.lng ?? -114) + (Math.random() * 0.4 - 0.1);
    const speed = 70 + Math.random() * 40;

    return this.prisma.load.update({
      where: { id },
      data: {
        lat,
        lng,
        speed,
        heading: load.heading ?? 'E',
        lastUpdate: 'just now',
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.load.delete({ where: { id } });
  }

  private assertCrossBorderReady(input: {
    crossBorder?: boolean;
    portOfEntryId?: string | null;
    customsProgram?: string | null;
    customsAce?: boolean;
    customsAci?: boolean;
    customsPaps?: boolean;
    customsPars?: boolean;
  }) {
    const errors = validateCrossBorderLoadFields(input);
    if (errors.length) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  private assertTransition(from: string, to: string) {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}`,
      );
    }
  }

  private tenantForwardHeaders(companyId: string): Record<string, string> {
    const store = getTenantStore();
    const headers: Record<string, string> = {
      [TENANT_HEADERS.companyId]: companyId,
    };
    if (store?.userId) headers[TENANT_HEADERS.userId] = store.userId;
    if (store?.role) headers[TENANT_HEADERS.userRole] = store.role;
    if (store?.email) headers[TENANT_HEADERS.userEmail] = store.email;
    if (store?.driverId) headers[TENANT_HEADERS.driverId] = store.driverId;
    if (store?.tenantKey) headers[TENANT_HEADERS.tenantKey] = store.tenantKey;
    if (store?.tenantStatus) {
      headers[TENANT_HEADERS.tenantStatus] = store.tenantStatus;
    }
    if (store?.routingMode) {
      headers[TENANT_HEADERS.routingMode] = store.routingMode;
    }
    if (store?.connectionUrl) {
      headers[TENANT_HEADERS.connectionUrl] = store.connectionUrl;
    }
    if (store?.dbName) headers[TENANT_HEADERS.dbName] = store.dbName;
    return headers;
  }

  /** Preserve gateway tenant ALS for async status notifications. */
  private voidNotifyWithTenant(
    store: TenantStore | undefined,
    task: () => Promise<void>,
    label: string,
  ): void {
    void (async () => {
      try {
        if (store) {
          await tenantAls.run(store, task);
        } else {
          await task();
        }
      } catch (e) {
        this.logger.warn(`${label}: ${String(e)}`);
      }
    })();
  }

  private async resolveDriverRecordId(
    driverId: string,
    companyId: string,
  ): Promise<string> {
    const base =
      this.config.get<string>('DRIVER_SERVICE_URL') ||
      'http://localhost:3003';
    const headers = this.tenantForwardHeaders(companyId);
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/drivers/${encodeURIComponent(driverId)}`,
        { headers },
      );
      if (res.ok) {
        const row = (await res.json()) as { id?: string };
        if (row?.id) return String(row.id);
      }
    } catch (e) {
      this.logger.warn(`resolveDriverRecordId failed: ${String(e)}`);
    }
    return driverId;
  }

  private async assertNoActiveLoad(driverId: string, excludeId?: string) {
    const active = await this.prisma.load.findFirst({
      where: {
        ...this.driverIdFilter(driverId),
        status: { in: [...ACTIVE_STATUSES] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (active) {
      throw new ConflictException(
        `Driver ${driverId} already has an active load (${active.id})`,
      );
    }
  }

  private async assertAssetsAssignable(input: {
    companyId: string;
    truckId?: string | null;
    trailerId?: string | null;
  }) {
    const ids: Array<{ id: string; kind: 'truck' | 'trailer' }> = [];
    if (input.truckId) ids.push({ id: input.truckId, kind: 'truck' });
    if (input.trailerId) ids.push({ id: input.trailerId, kind: 'trailer' });

    for (const { id, kind } of ids) {
      const asset = await this.prisma.asset.findUnique({ where: { id } });
      if (!asset) {
        throw new BadRequestException(
          `${kind === 'truck' ? 'Truck' : 'Trailer'} ${id} not found`,
        );
      }
      if (asset.companyId && asset.companyId !== input.companyId) {
        throw new BadRequestException(
          `${kind === 'truck' ? 'Truck' : 'Trailer'} belongs to another company`,
        );
      }
      if (!canAssignAssetStatus(asset.status)) {
        const reason = assetAssignmentBlockReason(asset.status, asset.unitNo);
        await this.auditAssignmentDeny({
          companyId: input.companyId,
          entityType: 'asset',
          entityId: asset.id,
          reason,
          meta: { kind, status: asset.status, unitNo: asset.unitNo },
        });
        throw new BadRequestException(reason);
      }
    }
  }

  private async assertDriverAssignable(driverId: string, companyId: string) {
    const base =
      this.config.get<string>('DRIVER_SERVICE_URL') ||
      'http://localhost:3003';
    const headers = this.tenantForwardHeaders(companyId);
    try {
      const detailRes = await fetch(
        `${base.replace(/\/$/, '')}/drivers/${encodeURIComponent(driverId)}`,
        { headers },
      );
      if (detailRes.status === 404) {
        return;
      }
      if (!detailRes.ok) return;
      const driver = (await detailRes.json()) as {
        active?: boolean;
        lifecycleStatus?: string;
        name?: string;
      };

      const readyRes = await fetch(
        `${base.replace(/\/$/, '')}/drivers/${encodeURIComponent(driverId)}/dispatch-ready`,
        { headers },
      );
      if (readyRes.ok) {
        const ready = (await readyRes.json()) as {
          ready?: boolean;
          missing?: string[];
          lifecycleOk?: boolean;
          lifecycleStatus?: string;
          availabilityOk?: boolean;
          availabilityStatus?: string;
        };
        if (!ready.lifecycleOk) {
          const reason = `Driver ${driver.name || driverId} is ${ready.lifecycleStatus || 'not active'} and cannot be assigned`;
          await this.auditAssignmentDeny({
            companyId,
            entityType: 'driver',
            entityId: driverId,
            reason,
            meta: {
              lifecycleStatus: ready.lifecycleStatus,
              action: 'compliance.dispatch_blocked',
            },
          });
          throw new BadRequestException(reason);
        }
        if (ready.availabilityOk === false) {
          const reason = `Driver ${driver.name || driverId} is ${ready.availabilityStatus || 'unavailable'} and cannot be assigned`;
          await this.auditAssignmentDeny({
            companyId,
            entityType: 'driver',
            entityId: driverId,
            reason,
            meta: {
              availabilityStatus: ready.availabilityStatus,
              action: 'compliance.dispatch_blocked',
            },
          });
          throw new BadRequestException(reason);
        }
        if (!ready.ready) {
          const missing = (ready.missing || []).join(', ');
          const reason = `Driver ${driver.name || driverId} is not dispatch-ready (missing/expired: ${missing})`;
          await this.auditAssignmentDeny({
            companyId,
            entityType: 'driver',
            entityId: driverId,
            reason,
            meta: {
              missing: ready.missing,
              action: 'compliance.dispatch_blocked',
            },
          });
          throw new BadRequestException(reason);
        }
        return;
      }

      if (driver.active === false || driver.lifecycleStatus === 'suspended') {
        const reason = `Driver ${driver.name || driverId} is inactive and cannot be assigned`;
        await this.auditAssignmentDeny({
          companyId,
          entityType: 'driver',
          entityId: driverId,
          reason,
          meta: { active: false, lifecycleStatus: driver.lifecycleStatus },
        });
        throw new BadRequestException(reason);
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`driver assignability check skipped: ${String(e)}`);
    }
  }

  private async assertDriverBorderEligible(
    driverId: string,
    companyId: string,
  ) {
    const base =
      this.config.get<string>('DRIVER_SERVICE_URL') ||
      'http://localhost:3003';
    const headers = this.tenantForwardHeaders(companyId);
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/drivers/${encodeURIComponent(driverId)}/border-eligible`,
        { headers },
      );
      if (res.status === 404) return;
      if (!res.ok) return;
      const border = (await res.json()) as {
        eligible?: boolean;
        missing?: string[];
        warnings?: string[];
      };
      if (!border.eligible) {
        const missing = (border.missing || []).join(', ');
        const reason = `Driver is not border-eligible (missing: ${missing})`;
        await this.auditAssignmentDeny({
          companyId,
          entityType: 'driver',
          entityId: driverId,
          reason,
          meta: {
            missing: border.missing,
            warnings: border.warnings,
            action: 'compliance.border_blocked',
          },
        });
        throw new BadRequestException(reason);
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`border eligibility check skipped: ${String(e)}`);
    }
  }

  private async auditAssignmentDeny(input: {
    companyId: string;
    entityType: string;
    entityId: string;
    reason: string;
    meta?: Record<string, unknown>;
  }) {
    const store = getTenantStore();
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    try {
      await fetch(`${base.replace(/\/$/, '')}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: input.companyId || store?.companyId || null,
          actorId: store?.userId || null,
          actorName: store?.email || '',
          action: 'mdm.assignment_denied',
          entityType: input.entityType,
          entityId: input.entityId,
          meta: { reason: input.reason, ...(input.meta || {}) },
        }),
      });
    } catch (e) {
      this.logger.warn(`assignment deny audit failed: ${String(e)}`);
    }
  }

  private internalApiKey(): string {
    return (
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev'
    );
  }

  private async verifyAuthUserInCompany(
    candidateId: string,
    companyId: string,
  ): Promise<string | null> {
    const id = candidateId.trim();
    if (!id) return null;
    void companyId;
    const authUrl =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    try {
      const res = await fetch(
        `${authUrl.replace(/\/$/, '')}/internal/users/${encodeURIComponent(id)}/session`,
        { headers: { 'x-internal-api-key': this.internalApiKey() } },
      );
      if (!res.ok) return null;
      const row = (await res.json()) as {
        authAllowed?: boolean;
        status?: string | null;
      };
      if (row.status === null && row.authAllowed === false) return null;
      return id;
    } catch {
      return null;
    }
  }

  private async lookupAuthUserIdByEmail(
    email: string,
    companyId: string,
  ): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const authUrl =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    try {
      const res = await fetch(
        `${authUrl.replace(/\/$/, '')}/internal/users/lookup?email=${encodeURIComponent(normalized)}`,
        { headers: { 'x-internal-api-key': this.internalApiKey() } },
      );
      if (!res.ok) return null;
      const row = (await res.json()) as {
        found?: boolean;
        id?: string;
        companyId?: string | null;
      };
      if (!row.found || !row.id) return null;
      if (row.companyId && row.companyId !== companyId) return null;
      return String(row.id);
    } catch {
      return null;
    }
  }

  private async resolveDriverAuthUser(
    driverRecordId: string,
    companyId: string,
  ): Promise<{ userId: string | null; name: string | null }> {
    const driverBase =
      this.config.get<string>('DRIVER_SERVICE_URL') ||
      'http://localhost:3003';
    const tenantHeaders = this.tenantForwardHeaders(companyId);
    try {
      const res = await fetch(
        `${driverBase.replace(/\/$/, '')}/drivers/${encodeURIComponent(driverRecordId)}`,
        { headers: tenantHeaders },
      );
      if (!res.ok) {
        this.logger.warn(
          `resolveDriverAuthUser HTTP ${res.status} driverId=${driverRecordId}`,
        );
        const fallback = await this.verifyAuthUserInCompany(
          driverRecordId,
          companyId,
        );
        if (fallback) {
          return { userId: fallback, name: null };
        }
        return { userId: null, name: null };
      }
      const row = (await res.json()) as {
        userId?: string | null;
        name?: string | null;
        email?: string | null;
      };
      let userId = row?.userId ? String(row.userId) : null;
      if (!userId && row?.email) {
        userId = await this.lookupAuthUserIdByEmail(String(row.email), companyId);
        if (userId) {
          this.logger.log(
            `Resolved driver ${driverRecordId} notify userId via email lookup`,
          );
        }
      }
      if (!userId) {
        userId = await this.verifyAuthUserInCompany(driverRecordId, companyId);
      }
      if (!userId) {
        this.logger.warn(
          `No auth userId for driver ${driverRecordId} — in-app notify skipped`,
        );
      }
      return {
        userId,
        name: row?.name ? String(row.name) : null,
      };
    } catch (e) {
      this.logger.warn(`resolveDriverAuthUser failed: ${String(e)}`);
      return { userId: null, name: null };
    }
  }

  private async postInAppNotify(input: {
    companyId: string;
    userId: string;
    title: string;
    body: string;
    link?: string;
    type?: string;
  }): Promise<void> {
    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    if (!notifyUrl) {
      this.logger.warn('NOTIFICATION_SERVICE_URL not set — in-app notify skipped');
      return;
    }
    const res = await fetch(
      `${notifyUrl.replace(/\/$/, '')}/in-app-notifications/internal/notify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': this.internalApiKey(),
        },
        body: JSON.stringify({
          companyId: input.companyId,
          userId: input.userId,
          title: input.title,
          body: input.body,
          link: input.link ?? '/',
          type: input.type ?? 'general',
        }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      this.logger.warn(
        `in-app notify HTTP ${res.status} userId=${input.userId}: ${detail}`,
      );
      throw new Error(`in-app notify HTTP ${res.status}`);
    }
  }

  private async notifyDriverLoadAssigned(load: {
    id: string;
    companyId: string;
    driverId: string | null;
    tripNo: string;
    origin: string;
    destination: string;
  }): Promise<void> {
    if (!load.driverId) return;
    const { userId } = await this.resolveDriverAuthUser(
      load.driverId,
      load.companyId,
    );
    if (!userId) return;

    const tripLabel = load.tripNo ? `Trip #${load.tripNo}` : 'New load';
    const body = `${tripLabel}: ${load.origin} → ${load.destination}`;

    await this.postInAppNotify({
      companyId: load.companyId,
      userId,
      title: 'Load assigned',
      body,
      link: '/driver/status',
      type: 'load.assigned',
    }).catch((e) =>
      this.logger.warn(`load assigned in-app failed: ${String(e)}`),
    );

    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    if (!notifyUrl) return;

    await fetch(`${notifyUrl.replace(/\/$/, '')}/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': this.internalApiKey(),
      },
      body: JSON.stringify({
        companyId: load.companyId,
        userId,
        title: 'Load assigned',
        body,
        data: {
          type: 'load.assigned',
          loadId: load.id,
          link: '/driver/status',
        },
      }),
    });
  }

  private tripRouteLabel(load: {
    tripNo: string;
    origin: string;
    destination: string;
  }): string {
    const tripLabel = load.tripNo ? `Trip #${load.tripNo}` : 'Load';
    return `${tripLabel}: ${load.origin} → ${load.destination}`;
  }

  private async listCompanyNotifyRecipientIds(companyId: string): Promise<string[]> {
    const authUrl =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    try {
      const res = await fetch(
        `${authUrl.replace(/\/$/, '')}/internal/companies/${encodeURIComponent(companyId)}/notify-recipients`,
        {
          headers: { 'x-internal-api-key': this.internalApiKey() },
        },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as unknown;
      return Array.isArray(data)
        ? data.filter((id): id is string => typeof id === 'string')
        : [];
    } catch (e) {
      this.logger.warn(`notify recipients lookup failed: ${String(e)}`);
      return [];
    }
  }

  private async notifyCompanyStaffInApp(input: {
    companyId: string;
    title: string;
    body: string;
    type: string;
    link?: string;
  }): Promise<void> {
    const recipientIds = await this.listCompanyNotifyRecipientIds(input.companyId);
    if (!recipientIds.length) return;
    await Promise.all(
      recipientIds.map((userId) =>
        this.postInAppNotify({
          companyId: input.companyId,
          userId,
          title: input.title,
          body: input.body,
          link: input.link ?? '/app/dispatch',
          type: input.type,
        }).catch((e) =>
          this.logger.warn(`company in-app notify failed: ${String(e)}`),
        ),
      ),
    );
  }

  private async notifyDriverInApp(input: {
    companyId: string;
    driverId: string | null;
    title: string;
    body: string;
    type: string;
    link?: string;
  }): Promise<void> {
    if (!input.driverId) return;
    const { userId } = await this.resolveDriverAuthUser(
      input.driverId,
      input.companyId,
    );
    if (!userId) return;
    await this.postInAppNotify({
      companyId: input.companyId,
      userId,
      title: input.title,
      body: input.body,
      link: input.link ?? '/',
      type: input.type,
    }).catch((e) =>
      this.logger.warn(`driver in-app notify failed: ${String(e)}`),
    );
  }

  /** Driver started trip → company staff only. */
  private async notifyCompanyStaffTripStarted(load: {
    id: string;
    companyId: string;
    driverId: string | null;
    tripNo: string;
    origin: string;
    destination: string;
  }): Promise<void> {
    const driver = load.driverId
      ? await this.resolveDriverAuthUser(load.driverId, load.companyId)
      : { userId: null, name: null };
    const driverLabel = driver.name?.trim() || 'Driver';
    const route = this.tripRouteLabel(load);
    await this.notifyCompanyStaffInApp({
      companyId: load.companyId,
      title: 'Trip started',
      body: `${driverLabel} started ${route}`,
      type: 'load.started',
    });
  }

  /** Dispatch started trip → assigned driver only. */
  private async notifyDriverTripStartedByDispatch(load: {
    companyId: string;
    driverId: string | null;
    tripNo: string;
    origin: string;
    destination: string;
  }): Promise<void> {
    const route = this.tripRouteLabel(load);
    await this.notifyDriverInApp({
      companyId: load.companyId,
      driverId: load.driverId,
      title: 'Trip started',
      body: `Dispatch started ${route}`,
      type: 'load.started.by_dispatch',
    });
  }

  /** Driver marked delivered → company staff only. */
  private async notifyCompanyStaffTripDelivered(load: {
    companyId: string;
    driverId: string | null;
    tripNo: string;
    origin: string;
    destination: string;
  }): Promise<void> {
    const driver = load.driverId
      ? await this.resolveDriverAuthUser(load.driverId, load.companyId)
      : { userId: null, name: null };
    const driverLabel = driver.name?.trim() || 'Driver';
    const route = this.tripRouteLabel(load);
    await this.notifyCompanyStaffInApp({
      companyId: load.companyId,
      title: 'Trip delivered',
      body: `${driverLabel} delivered ${route}`,
      type: 'load.delivered',
    });
  }

  /** Dispatch closed trip → assigned driver only. */
  private async notifyDriverTripDeliveredByDispatch(load: {
    companyId: string;
    driverId: string | null;
    tripNo: string;
    origin: string;
    destination: string;
  }): Promise<void> {
    const route = this.tripRouteLabel(load);
    await this.notifyDriverInApp({
      companyId: load.companyId,
      driverId: load.driverId,
      title: 'Trip delivered',
      body: `Dispatch marked ${route} as delivered`,
      type: 'load.delivered.by_dispatch',
    });
  }

  /** Dispatch cancelled trip → assigned driver only. */
  private async notifyDriverTripCancelledByDispatch(load: {
    companyId: string;
    driverId: string | null;
    tripNo: string;
    origin: string;
    destination: string;
  }): Promise<void> {
    const route = this.tripRouteLabel(load);
    await this.notifyDriverInApp({
      companyId: load.companyId,
      driverId: load.driverId,
      title: 'Trip cancelled',
      body: `Dispatch cancelled ${route}`,
      link: '/driver/status',
      type: 'load.cancelled',
    });
  }

  private async ensureExists(id: string) {
    const load = await this.prisma.load.findUnique({ where: { id } });
    if (!load) {
      throw new NotFoundException(`Load ${id} not found`);
    }
    return load;
  }
}
