import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  DISPATCH_REQUIRED_QUALIFICATIONS,
  DOC_TO_QUALIFICATION,
  computeQualificationStatus,
  type QualificationType,
} from '@tripsheet/shared';
import { CreateQualificationDto } from './dto/create-qualification.dto';
import { UpdateQualificationDto } from './dto/update-qualification.dto';

@Injectable()
export class QualificationsService {
  private readonly logger = new Logger(QualificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  findByDriver(driverId: string) {
    return this.prisma.driverQualification.findMany({
      where: { driverId },
      orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async create(driverId: string, dto: CreateQualificationDto) {
    await this.ensureDriver(driverId);
    const status = computeQualificationStatus(dto.expiryDate);
    const row = await this.prisma.driverQualification.create({
      data: {
        companyId: dto.companyId,
        driverId,
        type: dto.type,
        number: dto.number ?? null,
        class: dto.class ?? null,
        endorsements: (dto.endorsements as object) ?? undefined,
        issueDate: dto.issueDate ?? null,
        expiryDate: dto.expiryDate ?? null,
        issuingAuthority: dto.issuingAuthority ?? null,
        documentId: dto.documentId ?? null,
        status,
      },
    });
    void this.maybeNotifyExpiry(row.companyId, driverId, row.type, status);
    return row;
  }

  async update(id: string, dto: UpdateQualificationDto) {
    await this.ensureQual(id);
    const existing = await this.prisma.driverQualification.findUniqueOrThrow({
      where: { id },
    });
    const expiryDate =
      dto.expiryDate !== undefined ? dto.expiryDate : existing.expiryDate;
    const status =
      dto.status ?? computeQualificationStatus(expiryDate ?? undefined);
    const row = await this.prisma.driverQualification.update({
      where: { id },
      data: {
        type: dto.type,
        number: dto.number,
        class: dto.class,
        endorsements: dto.endorsements as object | undefined,
        issueDate: dto.issueDate,
        expiryDate: dto.expiryDate,
        issuingAuthority: dto.issuingAuthority,
        documentId: dto.documentId,
        status,
      },
    });
    void this.maybeNotifyExpiry(row.companyId, row.driverId, row.type, status);
    return row;
  }

  async remove(id: string) {
    await this.ensureQual(id);
    await this.prisma.driverQualification.delete({ where: { id } });
    return { deleted: true };
  }

  /** Sync qualification row from uploaded document */
  async syncFromDocument(input: {
    driverId: string;
    companyId: string;
    docType: string;
    documentId: string;
    expiryDate?: string | null;
    number?: string | null;
  }) {
    const qualType = DOC_TO_QUALIFICATION[input.docType];
    if (!qualType) return null;

    const status = computeQualificationStatus(input.expiryDate ?? undefined);
    const existing = await this.prisma.driverQualification.findFirst({
      where: { driverId: input.driverId, type: qualType },
    });

    const data = {
      companyId: input.companyId,
      number: input.number ?? existing?.number ?? null,
      expiryDate: input.expiryDate ?? existing?.expiryDate ?? null,
      documentId: input.documentId,
      status,
    };

    if (existing) {
      return this.prisma.driverQualification.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.driverQualification.create({
      data: {
        driverId: input.driverId,
        type: qualType,
        ...data,
      },
    });
  }

  /** Sync licence number from driver profile */
  async syncLicenseFromProfile(input: {
    driverId: string;
    companyId: string;
    licenseNo?: string | null;
  }) {
    if (!input.licenseNo?.trim()) return null;
    const existing = await this.prisma.driverQualification.findFirst({
      where: { driverId: input.driverId, type: 'license' },
    });
    if (existing) {
      return this.prisma.driverQualification.update({
        where: { id: existing.id },
        data: { number: input.licenseNo.trim() },
      });
    }
    return this.prisma.driverQualification.create({
      data: {
        companyId: input.companyId,
        driverId: input.driverId,
        type: 'license',
        number: input.licenseNo.trim(),
        status: computeQualificationStatus(undefined),
      },
    });
  }

  async syncFastFromProfile(input: {
    driverId: string;
    companyId: string;
    fastCard?: string | null;
  }) {
    if (!input.fastCard?.trim()) return null;
    const existing = await this.prisma.driverQualification.findFirst({
      where: { driverId: input.driverId, type: 'fast' },
    });
    if (existing) {
      return this.prisma.driverQualification.update({
        where: { id: existing.id },
        data: { number: input.fastCard.trim() },
      });
    }
    return this.prisma.driverQualification.create({
      data: {
        companyId: input.companyId,
        driverId: input.driverId,
        type: 'fast',
        number: input.fastCard.trim(),
        status: 'valid',
      },
    });
  }

  /** Seed qualifications from onboarding documents */
  async seedFromOnboarding(
    driverId: string,
    companyId: string,
    docs: Array<{ id: string; type: string; expiryDate?: string | null }>,
  ) {
    for (const doc of docs) {
      await this.syncFromDocument({
        driverId,
        companyId,
        docType: doc.type,
        documentId: doc.id,
        expiryDate: doc.expiryDate,
      });
    }
  }

  getDispatchBlockers(
    qualifications: Array<{ type: string; status: string }>,
    documents: Array<{ type: string; status: string; expiryDate?: string | null }>,
  ): string[] {
    const today = new Date().toISOString().slice(0, 10);
    const missing: string[] = [];
    const docBlocked = (doc?: {
      type?: string;
      status: string;
      expiryDate?: string | null;
    }) => {
      if (!doc) return true;
      if (doc.expiryDate && doc.expiryDate < today) return true;
      if (doc.status === 'expired' || doc.status === 'missing') {
        if (doc.expiryDate && doc.expiryDate >= today) return false;
        return true;
      }
      return false;
    };

    for (const type of DISPATCH_REQUIRED_QUALIFICATIONS) {
      const qual = qualifications.find((q) => q.type === type);
      if (qual) {
        if (qual.status === 'expired' || qual.status === 'missing') {
          missing.push(type);
        }
        continue;
      }
      const docType = type === 'license' ? 'license' : type;
      const doc = documents.find((d) => d.type === docType);
      if (docBlocked(doc)) missing.push(type);
    }

    const abstract = documents.find((d) => d.type === 'abstract');
    if (docBlocked(abstract)) {
      if (!missing.includes('abstract')) missing.push('abstract');
    }

    return missing;
  }

  private async maybeNotifyExpiry(
    companyId: string,
    driverId: string,
    qualType: string,
    status: string,
  ) {
    if (status !== 'expired' && status !== 'expiring_soon') return;
    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    if (!notifyUrl) return;
    try {
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
        select: { name: true, email: true },
      });
      await fetch(`${notifyUrl.replace(/\/$/, '')}/notifications/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          channel: 'email',
          to: driver?.email || 'ops@company.local',
          body: `Driver ${driver?.name || driverId}: ${qualType} qualification is ${status.replace('_', ' ')}.`,
          status: 'queued',
          meta: {
            type: 'driver.qualification_expiry',
            driverId,
            qualType,
            qualStatus: status,
          },
        }),
      });
    } catch (e) {
      this.logger.warn(`qualification expiry notify failed: ${String(e)}`);
    }
  }

  private async ensureDriver(driverId: string) {
    const d = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) throw new NotFoundException(`Driver ${driverId} not found`);
    return d;
  }

  private async ensureQual(id: string) {
    const q = await this.prisma.driverQualification.findUnique({
      where: { id },
    });
    if (!q) throw new NotFoundException(`Qualification ${id} not found`);
    return q;
  }
}
