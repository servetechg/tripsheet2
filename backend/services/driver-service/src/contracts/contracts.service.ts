import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertContractDto } from './dto/upsert-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(driverId?: string) {
    return this.prisma.contract.findMany({
      where: driverId ? { driverId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException(`Contract ${id} not found`);
    }
    return contract;
  }

  async upsert(dto: UpsertContractDto) {
    const payload =
      dto.payload === undefined
        ? undefined
        : (dto.payload as Prisma.InputJsonValue);

    const fields = {
      driverId: dto.driverId,
      companyId: dto.companyId,
      driverName: dto.driverName,
      companyName: dto.companyName,
      startDate: dto.startDate,
      payType: dto.payType,
      payRate: dto.payRate,
      payUnit: dto.payUnit,
      teamRate: dto.teamRate,
      detentionRate: dto.detentionRate,
      waitRate: dto.waitRate,
      fuelSurcharge: dto.fuelSurcharge,
      vacationPct: dto.vacationPct,
      trialDays: dto.trialDays,
      noticeDays: dto.noticeDays,
      benefits: dto.benefits,
      signedByDriver: dto.signedByDriver,
      signedByAdmin: dto.signedByAdmin,
      signedAt: dto.signedAt,
      driverSignature: dto.driverSignature,
      adminSignature: dto.adminSignature,
      ...(payload !== undefined ? { payload } : {}),
    };

    if (dto.id) {
      await this.ensureExists(dto.id);
      return this.prisma.contract.update({
        where: { id: dto.id },
        data: fields,
      });
    }

    return this.prisma.contract.create({ data: fields });
  }

  async update(id: string, dto: UpsertContractDto) {
    return this.upsert({ ...dto, id });
  }

  async sign(id: string, dto: SignContractDto) {
    await this.ensureExists(id);
    const signedAt = new Date().toISOString();

    if (dto.role === 'driver') {
      return this.prisma.contract.update({
        where: { id },
        data: {
          signedByDriver: true,
          driverSignature: dto.signature,
          signedAt,
        },
      });
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        signedByAdmin: true,
        adminSignature: dto.signature,
        signedAt,
      },
    });
  }

  private async ensureExists(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException(`Contract ${id} not found`);
    }
    return contract;
  }
}
