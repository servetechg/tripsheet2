import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

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
          status: dto.status ?? 'active',
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
          status: dto.status,
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

  async toggleActive(id: string) {
    const asset = await this.ensureExists(id);
    const next = asset.status === 'active' ? 'inactive' : 'active';
    return this.prisma.asset.update({
      where: { id },
      data: { status: next },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.asset.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset ${id} not found`);
    }
    return asset;
  }
}
