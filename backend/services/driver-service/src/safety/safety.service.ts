import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSafetyEventDto,
  UpdateSafetyEventDto,
} from './dto/safety.dto';

@Injectable()
export class SafetyService {
  constructor(private readonly prisma: PrismaService) {}

  findByDriver(driverId: string) {
    return this.prisma.driverSafetyEvent.findMany({
      where: { driverId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async create(driverId: string, dto: CreateSafetyEventDto) {
    await this.ensureDriver(driverId);
    return this.prisma.driverSafetyEvent.create({
      data: {
        companyId: dto.companyId,
        driverId,
        type: dto.type,
        occurredAt: dto.occurredAt,
        description: dto.description,
        preventable: dto.preventable ?? null,
        status: dto.status ?? 'open',
      },
    });
  }

  async update(id: string, dto: UpdateSafetyEventDto) {
    await this.ensureEvent(id);
    return this.prisma.driverSafetyEvent.update({
      where: { id },
      data: {
        type: dto.type,
        occurredAt: dto.occurredAt,
        description: dto.description,
        preventable: dto.preventable,
        status: dto.status,
      },
    });
  }

  async remove(id: string) {
    await this.ensureEvent(id);
    await this.prisma.driverSafetyEvent.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureDriver(driverId: string) {
    const d = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) throw new NotFoundException(`Driver ${driverId} not found`);
    return d;
  }

  private async ensureEvent(id: string) {
    const e = await this.prisma.driverSafetyEvent.findUnique({ where: { id } });
    if (!e) throw new NotFoundException(`Safety event ${id} not found`);
    return e;
  }
}
