import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getTenantStore } from '@tripsheet/tenant-runtime';
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
    return this.prisma.load.findMany({
      where: {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.driverId ? { driverId: query.driverId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
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

    await this.assertNoActiveLoad(dto.driverId);
    await this.assertDriverAssignable(dto.driverId, dto.companyId);
    await this.assertAssetsAssignable({
      companyId: dto.companyId,
      truckId: dto.truckId,
      trailerId: dto.trailerId,
    });
    this.assertCrossBorderReady(dto);

    const status = dto.status ?? 'assigned';
    if (status !== 'assigned' && status !== 'in_transit') {
      throw new BadRequestException(
        'New loads must start as assigned or in_transit',
      );
    }

    return this.prisma.load.create({
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
        tripNo: dto.tripNo,
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

    return this.prisma.load.update({
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
        tripNo: dto.tripNo,
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
  }

  async updateStatus(id: string, dto: UpdateLoadStatusDto) {
    const existing = await this.ensureExists(id);
    this.assertTransition(existing.status, dto.status);

    return this.prisma.load.update({
      where: { id },
      data: { status: dto.status },
    });
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

  private async assertNoActiveLoad(driverId: string, excludeId?: string) {
    const active = await this.prisma.load.findFirst({
      where: {
        driverId,
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
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/drivers/${encodeURIComponent(driverId)}`,
        {
          headers: {
            'x-company-id': companyId,
            ...(getTenantStore()?.userId
              ? { 'x-user-id': getTenantStore()!.userId! }
              : {}),
          },
        },
      );
      if (res.status === 404) {
        // driverId may be auth user id — allow if driver-service has no match
        return;
      }
      if (!res.ok) return;
      const driver = (await res.json()) as {
        active?: boolean;
        name?: string;
        companyId?: string;
      };
      if (driver.active === false) {
        const reason = `Driver ${driver.name || driverId} is inactive and cannot be assigned`;
        await this.auditAssignmentDeny({
          companyId,
          entityType: 'driver',
          entityId: driverId,
          reason,
          meta: { active: false },
        });
        throw new BadRequestException(reason);
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`driver assignability check skipped: ${String(e)}`);
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

  private async ensureExists(id: string) {
    const load = await this.prisma.load.findUnique({ where: { id } });
    if (!load) {
      throw new NotFoundException(`Load ${id} not found`);
    }
    return load;
  }
}
