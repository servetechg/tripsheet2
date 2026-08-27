import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import {
  DEFAULT_EQUIPMENT_TYPES,
  normalizeAssetStatus,
} from './asset-status';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListAssetsDto) {
    return this.prisma.asset.findMany({
      where: {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: [{ type: 'asc' }, { unitNo: 'asc' }],
    });
  }

  async create(dto: CreateAssetDto) {
    const status = normalizeAssetStatus(dto.status ?? 'available');
    try {
      return await this.prisma.asset.create({
        data: {
          companyId: dto.companyId,
          type: dto.type,
          unitNo: dto.unitNo.trim(),
          year: dto.year,
          make: dto.make,
          model: dto.model,
          vin: dto.vin,
          plate: dto.plate,
          status,
          insuranceExpiry: dto.insuranceExpiry,
          plateExpiry: dto.plateExpiry,
          permitExpiry: dto.permitExpiry,
          notes: dto.notes,
          equipmentTypeCode: dto.equipmentTypeCode?.trim() || null,
          branchId: (dto as { branchId?: string }).branchId,
          insuranceProviderId: dto.insuranceProviderId || null,
          insuranceProviderName: dto.insuranceProviderName || null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Unit No. ${dto.unitNo} already exists for this company`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateAssetDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.asset.update({
        where: { id },
        data: {
          type: dto.type,
          unitNo: dto.unitNo?.trim(),
          year: dto.year,
          make: dto.make,
          model: dto.model,
          vin: dto.vin,
          plate: dto.plate,
          status:
            dto.status !== undefined
              ? normalizeAssetStatus(dto.status)
              : undefined,
          insuranceExpiry: dto.insuranceExpiry,
          plateExpiry: dto.plateExpiry,
          permitExpiry: dto.permitExpiry,
          notes: dto.notes,
          equipmentTypeCode:
            dto.equipmentTypeCode !== undefined
              ? dto.equipmentTypeCode?.trim() || null
              : undefined,
          insuranceProviderId:
            dto.insuranceProviderId !== undefined
              ? dto.insuranceProviderId || null
              : undefined,
          insuranceProviderName:
            dto.insuranceProviderName !== undefined
              ? dto.insuranceProviderName || null
              : undefined,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Unit No. ${dto.unitNo} already exists for this company`,
        );
      }
      throw err;
    }
  }

  /**
   * Legacy toggle: available ↔ retired (maps old active ↔ inactive).
   * Prefer PATCH with explicit status for Out of Service / Maintenance.
   */
  async toggleActive(id: string) {
    const asset = await this.ensureExists(id);
    const current = normalizeAssetStatus(asset.status);
    const next =
      current === 'available' || current === 'assigned'
        ? 'retired'
        : 'available';
    return this.prisma.asset.update({
      where: { id },
      data: { status: next },
    });
  }

  async setStatus(id: string, status: string) {
    await this.ensureExists(id);
    const next = normalizeAssetStatus(status);
    return this.prisma.asset.update({
      where: { id },
      data: { status: next },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.asset.delete({ where: { id } });
  }

  async listEquipmentTypes(companyId: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException('companyId is required');
    }
    await this.ensureEquipmentTypesSeeded(companyId);
    return this.prisma.equipmentType.findMany({
      where: { companyId, status: 'active' },
      orderBy: { name: 'asc' },
    });
  }

  private async ensureEquipmentTypesSeeded(companyId: string) {
    const count = await this.prisma.equipmentType.count({
      where: { companyId },
    });
    if (count > 0) return;
    try {
      await this.prisma.equipmentType.createMany({
        data: DEFAULT_EQUIPMENT_TYPES.map((t) => ({
          id: `eqt_${companyId}_${t.code}`,
          companyId,
          code: t.code,
          name: t.name,
          system: true,
          status: 'active',
        })),
        skipDuplicates: true,
      });
    } catch {
      /* table may not exist yet on old tenants — schema-migrate-all */
    }
  }

  private async ensureExists(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset ${id} not found`);
    }
    return asset;
  }
}
