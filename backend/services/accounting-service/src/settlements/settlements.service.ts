import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto, SettlementLineDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['approved'],
  approved: ['paid'],
  paid: [],
};

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string, driverId?: string, status?: string) {
    return this.prisma.settlement.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(driverId ? { driverId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.ensureExists(id);
  }

  create(dto: CreateSettlementDto) {
    const totalAmount = this.sumLines(dto.lines);

    return this.prisma.settlement.create({
      data: {
        companyId: dto.companyId,
        driverId: dto.driverId,
        driverName: dto.driverName ?? '',
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        currency: dto.currency ?? 'CAD',
        notes: dto.notes ?? '',
        status: 'draft',
        totalAmount,
        lines: dto.lines as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateSettlementDto) {
    await this.ensureExists(id);

    const data: Prisma.SettlementUpdateInput = {};
    if (dto.driverName !== undefined) data.driverName = dto.driverName;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.lines !== undefined) {
      data.lines = dto.lines as unknown as Prisma.InputJsonValue;
      data.totalAmount = this.sumLines(dto.lines);
    }

    return this.prisma.settlement.update({
      where: { id },
      data,
    });
  }

  async approve(id: string) {
    const settlement = await this.ensureExists(id);
    this.assertTransition(settlement.status, 'approved');

    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'approved' },
    });
  }

  async pay(id: string) {
    const settlement = await this.ensureExists(id);
    this.assertTransition(settlement.status, 'paid');

    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'paid' },
    });
  }

  async remove(id: string) {
    const settlement = await this.ensureExists(id);

    if (settlement.status !== 'draft') {
      throw new BadRequestException(
        'Only draft settlements can be deleted',
      );
    }

    await this.prisma.settlement.delete({ where: { id } });
    return { deleted: true, id };
  }

  sumLines(lines: SettlementLineDto[]): number {
    return lines.reduce((sum, line) => sum + line.amount, 0);
  }

  private assertTransition(currentStatus: string, nextStatus: string) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition settlement from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private async ensureExists(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement) {
      throw new NotFoundException(`Settlement ${id} not found`);
    }
    return settlement;
  }
}
