import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

const DISPATCH_REQUIRED_DOCS = ['license', 'abstract', 'medical'] as const;

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string) {
    return this.prisma.driver.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { name: 'asc' },
      include: { documents: true, contracts: true },
    });
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { documents: true, contracts: true },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }

  create(dto: CreateDriverDto) {
    const { password: _password, ...data } = dto;
    return this.prisma.driver.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        email: data.email.toLowerCase(),
        userId: data.userId,
        phone: data.phone,
        dob: data.dob,
        licenseNo: data.licenseNo,
        citizenship: data.citizenship,
        address: data.address,
        emergencyName: data.emergencyName,
        emergencyPhone: data.emergencyPhone,
        fastCard: data.fastCard,
        notes: data.notes,
        sin: data.sin,
        active: data.active ?? true,
      },
      include: { documents: true, contracts: true },
    });
  }

  async update(id: string, dto: UpdateDriverDto) {
    await this.ensureExists(id);
    return this.prisma.driver.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email?.toLowerCase(),
        userId: dto.userId,
        phone: dto.phone,
        dob: dto.dob,
        licenseNo: dto.licenseNo,
        citizenship: dto.citizenship,
        address: dto.address,
        emergencyName: dto.emergencyName,
        emergencyPhone: dto.emergencyPhone,
        fastCard: dto.fastCard,
        notes: dto.notes,
        sin: dto.sin,
        active: dto.active,
      },
      include: { documents: true, contracts: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.driver.delete({ where: { id } });
    return { deleted: true };
  }

  async dispatchReady(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const missing: string[] = [];

    for (const type of DISPATCH_REQUIRED_DOCS) {
      const doc = driver.documents.find((d) => d.type === type);
      if (!doc || doc.status === 'expired') {
        missing.push(type);
        continue;
      }
      if (doc.expiryDate && doc.expiryDate < today) {
        missing.push(type);
      }
    }

    return { ready: missing.length === 0, missing };
  }

  private async ensureExists(id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }
}
