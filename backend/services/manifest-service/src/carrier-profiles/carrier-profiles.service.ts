import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCarrierProfileDto } from './dto/upsert-carrier-profile.dto';

@Injectable()
export class CarrierProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string) {
    return this.prisma.carrierProfile.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { companyId: 'asc' },
    });
  }

  async findByCompanyId(companyId: string) {
    const profile = await this.prisma.carrierProfile.findUnique({
      where: { companyId },
    });
    if (!profile) {
      throw new NotFoundException(
        `Carrier profile for company ${companyId} not found`,
      );
    }
    return profile;
  }

  upsert(companyId: string, dto: UpsertCarrierProfileDto) {
    return this.prisma.carrierProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        cbsaCarrierCode: dto.cbsaCarrierCode ?? '',
        scacCode: dto.scacCode ?? '',
        dotNumber: dto.dotNumber ?? '',
        csnNumber: dto.csnNumber ?? '',
        fastLane: dto.fastLane ?? false,
      },
      update: {
        cbsaCarrierCode: dto.cbsaCarrierCode,
        scacCode: dto.scacCode,
        dotNumber: dto.dotNumber,
        csnNumber: dto.csnNumber,
        fastLane: dto.fastLane,
      },
    });
  }
}
