import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripSheetDto } from './dto/create-trip-sheet.dto';
import { UpdateTripSheetDto } from './dto/update-trip-sheet.dto';

@Injectable()
export class TripSheetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string, driverId?: string) {
    return this.prisma.tripSheet.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(driverId ? { driverId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.ensureExists(id);
  }

  create(dto: CreateTripSheetDto) {
    return this.prisma.tripSheet.create({
      data: {
        companyId: dto.companyId,
        driverId: dto.driverId,
        header: dto.header as Prisma.InputJsonValue,
        trips: (dto.trips ?? []) as Prisma.InputJsonValue,
        expenses: (dto.expenses ?? []) as Prisma.InputJsonValue,
        notes: dto.notes ?? '',
      },
    });
  }

  async update(id: string, dto: UpdateTripSheetDto) {
    await this.ensureExists(id);
    return this.prisma.tripSheet.update({
      where: { id },
      data: {
        driverId: dto.driverId,
        header:
          dto.header !== undefined
            ? (dto.header as Prisma.InputJsonValue)
            : undefined,
        trips:
          dto.trips !== undefined
            ? (dto.trips as Prisma.InputJsonValue)
            : undefined,
        expenses:
          dto.expenses !== undefined
            ? (dto.expenses as Prisma.InputJsonValue)
            : undefined,
        notes: dto.notes,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.tripSheet.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async ensureExists(id: string) {
    const sheet = await this.prisma.tripSheet.findUnique({ where: { id } });
    if (!sheet) {
      throw new NotFoundException(`Trip sheet ${id} not found`);
    }
    return sheet;
  }
}
