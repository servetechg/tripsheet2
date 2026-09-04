import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantStore } from '@tripsheet/tenant-runtime';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  findByDriver(driverId: string) {
    return this.prisma.driverEquipmentAssignment.findMany({
      where: { driverId },
      orderBy: [{ unassignedAt: 'asc' }, { assignedAt: 'desc' }],
    });
  }

  findActivePrimary(driverId: string, assetType: string) {
    return this.prisma.driverEquipmentAssignment.findFirst({
      where: {
        driverId,
        assetType,
        role: 'primary',
        unassignedAt: null,
      },
    });
  }

  async assign(driverId: string, dto: AssignEquipmentDto) {
    await this.ensureDriver(driverId);
    const role = dto.role ?? 'primary';
    let unitNo = dto.unitNo ?? null;

    if (!unitNo) {
      const asset = await this.fetchAsset(dto.assetId, dto.companyId);
      if (asset) {
        unitNo = asset.unitNo ?? null;
        if (asset.type && asset.type !== dto.assetType) {
          throw new BadRequestException(
            `Asset type mismatch: expected ${dto.assetType}, got ${asset.type}`,
          );
        }
      }
    }

    if (role === 'primary') {
      await this.prisma.driverEquipmentAssignment.updateMany({
        where: {
          driverId,
          assetType: dto.assetType,
          role: 'primary',
          unassignedAt: null,
        },
        data: { unassignedAt: new Date() },
      });
    }

    const store = getTenantStore();
    return this.prisma.driverEquipmentAssignment.create({
      data: {
        companyId: dto.companyId,
        driverId,
        assetId: dto.assetId,
        assetType: dto.assetType,
        role,
        unitNo,
        notes: dto.notes ?? null,
        assignedByUserId: store?.userId ?? null,
      },
    });
  }

  async unassign(id: string) {
    const row = await this.prisma.driverEquipmentAssignment.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException(`Assignment ${id} not found`);
    if (row.unassignedAt) return row;
    return this.prisma.driverEquipmentAssignment.update({
      where: { id },
      data: { unassignedAt: new Date() },
    });
  }

  private async fetchAsset(assetId: string, companyId: string) {
    const base =
      this.config.get<string>('FLEET_SERVICE_URL') || 'http://localhost:3004';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/assets/${encodeURIComponent(assetId)}`,
        {
          headers: {
            'x-company-id': companyId,
            ...(getTenantStore()?.userId
              ? { 'x-user-id': getTenantStore()!.userId! }
              : {}),
          },
        },
      );
      if (!res.ok) return null;
      return (await res.json()) as { unitNo?: string; type?: string };
    } catch (e) {
      this.logger.warn(`fetch asset failed: ${String(e)}`);
      return null;
    }
  }

  private async ensureDriver(driverId: string) {
    const d = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) throw new NotFoundException(`Driver ${driverId} not found`);
    return d;
  }
}
