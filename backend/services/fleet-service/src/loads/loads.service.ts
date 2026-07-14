import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveLoadsDto } from './dto/active-loads.dto';
import { CreateLoadDto } from './dto/create-load.dto';
import { ListLoadsDto } from './dto/list-loads.dto';
import { UpdateLoadDto } from './dto/update-load.dto';
import { UpdateLoadStatusDto } from './dto/update-load-status.dto';

const ACTIVE_STATUSES = ['assigned', 'in_transit'] as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class LoadsService {
  constructor(private readonly prisma: PrismaService) {}

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
        tripNo: dto.tripNo,
        notes: dto.notes,
        truckNo: dto.truckNo,
        trailerNo: dto.trailerNo,
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed,
        heading: dto.heading,
        lastUpdate: dto.lastUpdate,
      },
    });
  }

  async update(id: string, dto: UpdateLoadDto) {
    const existing = await this.ensureExists(id);

    if (dto.status !== undefined && dto.status !== existing.status) {
      this.assertTransition(existing.status, dto.status);
    }

    if (
      dto.driverId !== undefined &&
      dto.driverId !== existing.driverId &&
      ACTIVE_STATUSES.includes(
        (dto.status ?? existing.status) as (typeof ACTIVE_STATUSES)[number],
      )
    ) {
      await this.assertNoActiveLoad(dto.driverId, id);
    }

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
        tripNo: dto.tripNo,
        notes: dto.notes,
        truckNo: dto.truckNo,
        trailerNo: dto.trailerNo,
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed,
        heading: dto.heading,
        lastUpdate: dto.lastUpdate,
        status: dto.status,
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

  private async ensureExists(id: string) {
    const load = await this.prisma.load.findUnique({ where: { id } });
    if (!load) {
      throw new NotFoundException(`Load ${id} not found`);
    }
    return load;
  }
}
