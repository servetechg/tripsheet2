import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import {
  actorHasPermission,
  getTenantStore,
} from '@tripsheet/tenant-runtime';

const DISPATCH_REQUIRED_DOCS = ['license', 'abstract', 'medical'] as const;

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(companyId?: string, userId?: string) {
    const store = getTenantStore();
    const asDriver = store?.role === 'driver';
    const uid = asDriver ? store?.userId : userId;
    const rows = await this.prisma.driver.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(uid ? { userId: uid } : {}),
      },
      orderBy: { name: 'asc' },
      include: { documents: true, contracts: true },
    });
    const canWage =
      actorHasPermission('drivers.wage.view') || asDriver;
    if (canWage) return rows;
    return rows.map((d) => this.redactWage(d));
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

  async create(dto: CreateDriverDto) {
    await this.assertDriverQuota(dto.companyId);
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
        branchId: data.branchId,
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
        branchId: dto.branchId,
      },
      include: { documents: true, contracts: true },
    });
  }

  private async assertDriverQuota(companyId: string) {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/companies/${encodeURIComponent(companyId)}/entitlements`,
      );
      if (!res.ok) return;
      const ent = (await res.json()) as { maxDrivers?: number };
      const max = ent.maxDrivers ?? -1;
      if (max < 0) return;
      const count = await this.prisma.driver.count({ where: { companyId } });
      if (count >= max) {
        throw new ForbiddenException(
          `Driver limit reached for plan (max ${max})`,
        );
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      /* entitlements unavailable — allow create */
    }
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

  private redactWage<T extends { contracts?: Array<Record<string, unknown>> }>(
    driver: T,
  ): T {
    return {
      ...driver,
      contracts: (driver.contracts || []).map((c) => ({
        ...c,
        payType: null,
        payRate: null,
        payUnit: null,
        teamRate: null,
        detentionRate: null,
        waitRate: null,
        fuelSurcharge: null,
        vacationPct: null,
      })),
    };
  }

  private async ensureExists(id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }
}
