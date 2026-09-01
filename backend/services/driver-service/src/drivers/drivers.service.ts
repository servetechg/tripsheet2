import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DISPATCH_REQUIRED_DOCS,
  availabilityAllowsDispatch,
  checkBorderEligibility,
  lifecycleAllowsDispatch,
  syncActiveFromLifecycle,
  type DriverLifecycleStatus,
} from '@tripsheet/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSyncService } from '../auth-sync/auth-sync.service';
import { DocumentsService } from '../documents/documents.service';
import { QualificationsService } from '../qualifications/qualifications.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import {
  actorHasPermission,
  assertPermission,
  getTenantStore,
} from '@tripsheet/tenant-runtime';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authSync: AuthSyncService,
    private readonly qualifications: QualificationsService,
    private readonly documentsService: DocumentsService,
  ) {}

  async findAll(companyId?: string, userId?: string) {
    const store = getTenantStore();
    const asDriver = store?.role === 'driver';
    const uid = asDriver ? store?.userId : userId;
    const rows = await this.prisma.driver.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(uid ? { userId: uid } : {}),
        lifecycleStatus: { not: 'archived' },
      },
      orderBy: { name: 'asc' },
      include: {
        documents: true,
        contracts: true,
        qualifications: true,
      },
    });
    const canWage =
      actorHasPermission('drivers.wage.view') || asDriver;
    if (canWage) return rows.map((d) => this.withLegacyActive(d));
    return rows.map((d) =>
      this.withLegacyActive(this.redactWage(d)),
    );
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        documents: true,
        contracts: true,
        qualifications: true,
      },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return this.withLegacyActive(driver);
  }

  async create(dto: CreateDriverDto) {
    await this.assertDriverQuota(dto.companyId);
    const { password: _password, ...data } = dto;
    const lifecycleStatus =
      data.lifecycleStatus ??
      (data.active === false ? 'suspended' : 'active');
    const driver = await this.prisma.driver.create({
      data: this.driverCreateData(data, lifecycleStatus),
      include: {
        documents: true,
        contracts: true,
        qualifications: true,
      },
    });
    await this.qualifications.syncLicenseFromProfile({
      driverId: driver.id,
      companyId: driver.companyId,
      licenseNo: driver.licenseNo,
    });
    if (driver.fastCard) {
      await this.qualifications.syncFastFromProfile({
        driverId: driver.id,
        companyId: driver.companyId,
        fastCard: driver.fastCard,
      });
    }
    return this.withLegacyActive(driver);
  }

  async update(id: string, dto: UpdateDriverDto) {
    const existing = await this.ensureExists(id);
    let lifecycleStatus = dto.lifecycleStatus;
    if (lifecycleStatus === undefined && dto.active !== undefined) {
      lifecycleStatus = dto.active ? 'active' : 'suspended';
    }
    const driver = await this.prisma.driver.update({
      where: { id },
      data: this.driverUpdateData(dto, lifecycleStatus),
      include: {
        documents: true,
        contracts: true,
        qualifications: true,
      },
    });
    if (dto.licenseNo !== undefined) {
      await this.qualifications.syncLicenseFromProfile({
        driverId: driver.id,
        companyId: driver.companyId,
        licenseNo: driver.licenseNo,
      });
    }
    if (dto.fastCard !== undefined) {
      await this.qualifications.syncFastFromProfile({
        driverId: driver.id,
        companyId: driver.companyId,
        fastCard: driver.fastCard,
      });
    }
    if (
      lifecycleStatus !== undefined &&
      lifecycleStatus !== existing.lifecycleStatus
    ) {
      await this.authSync.syncDriverLifecycle(driver.userId, lifecycleStatus);
    }
    return this.withLegacyActive(driver);
  }

  async approve(id: string) {
    assertPermission('drivers.approve');
    const driver = await this.ensureExists(id);
    if (
      driver.lifecycleStatus !== 'pending_review' &&
      driver.lifecycleStatus !== 'approved'
    ) {
      throw new BadRequestException(
        `Driver must be pending HR review to approve (current: ${driver.lifecycleStatus})`,
      );
    }
    const missing = await this.complianceMissing(id);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot approve — missing or expired: ${missing.join(', ')}`,
      );
    }
    return this.setLifecycle(id, 'active', 'drivers.approve');
  }

  async suspend(id: string, reason?: string) {
    assertPermission('drivers.suspend');
    return this.setLifecycle(id, 'suspended', 'drivers.suspend', reason);
  }

  async terminate(id: string, reason?: string) {
    assertPermission('drivers.suspend');
    return this.setLifecycle(id, 'terminated', 'drivers.suspend', reason);
  }

  async archive(id: string) {
    assertPermission('drivers.archive');
    return this.setLifecycle(id, 'archived', 'drivers.archive');
  }

  async remove(id: string) {
    return this.archive(id);
  }

  async dispatchReady(id: string) {
    const driver = await this.driverWithCompliance(id);
    const lifecycleOk = lifecycleAllowsDispatch(driver.lifecycleStatus);
    const availabilityOk = availabilityAllowsDispatch(
      driver.availabilityStatus,
    );
    const missing = this.collectComplianceMissing(driver);

    return {
      ready: lifecycleOk && availabilityOk && missing.length === 0,
      missing,
      lifecycleStatus: driver.lifecycleStatus,
      lifecycleOk,
      availabilityStatus: driver.availabilityStatus,
      availabilityOk,
    };
  }

  /** Docs/qualifications required before HR can activate a driver. */
  private async complianceMissing(id: string): Promise<string[]> {
    const driver = await this.driverWithCompliance(id);
    return this.collectComplianceMissing(driver);
  }

  private async driverWithCompliance(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { qualifications: true },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    // Same query path as GET /documents (tenant-safe)
    const documents = await this.documentsService.findAll({
      driverId: id,
      companyId: driver.companyId,
    });
    return { ...driver, documents };
  }

  private collectComplianceMissing(driver: {
    documents: Array<{ type: string; status: string; expiryDate?: string | null }>;
    qualifications: Array<{ type: string; status: string }>;
  }): string[] {
    const missing = this.qualifications.getDispatchBlockers(
      driver.qualifications,
      driver.documents,
    );

    // Legacy doc-only check when no qualifications seeded yet
    if (missing.length === 0 && driver.qualifications.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      for (const type of DISPATCH_REQUIRED_DOCS) {
        const doc = driver.documents.find((d) => d.type === type);
        if (!doc || doc.status === 'expired') missing.push(type);
        else if (doc.expiryDate && doc.expiryDate < today) missing.push(type);
      }
    }

    return missing;
  }

  async borderEligible(id: string) {
    const driver = await this.driverWithCompliance(id);
    const result = checkBorderEligibility({
      qualifications: driver.qualifications,
      documents: driver.documents,
      citizenship: driver.citizenship,
      fastCard: driver.fastCard,
    });
    return {
      ...result,
      driverId: driver.id,
      citizenship: driver.citizenship,
    };
  }

  async performance(id: string) {
    const driver = await this.ensureExists(id);
    const loads = await this.fetchDriverLoads(driver);
    const delivered = loads.filter((l) => l.status === 'delivered');
    const inTransit = loads.filter((l) => l.status === 'in_transit');
    const miles = loads.reduce((s, l) => s + (Number(l.miles) || 0), 0);
    let onTime = 0;
    for (const l of delivered) {
      if (l.actualDelivery && l.eta && l.actualDelivery <= l.eta) onTime++;
      else if (l.actualDelivery && !l.eta) onTime++;
    }
    const revenue = loads.reduce(
      (s, l) => s + (Number(l.customerRate) || 0),
      0,
    );
    return {
      driverId: driver.id,
      period: 'all_time',
      totalLoads: loads.length,
      deliveriesCompleted: delivered.length,
      inTransit: inTransit.length,
      totalMiles: miles,
      loadedMiles: miles,
      revenue,
      onTimeDeliveries: onTime,
      onTimePct:
        delivered.length > 0
          ? Math.round((onTime / delivered.length) * 1000) / 10
          : null,
      lateDeliveries: delivered.length - onTime,
    };
  }

  private async fetchDriverLoads(driver: {
    id: string;
    userId: string | null;
    companyId: string;
  }) {
    const base =
      this.config.get<string>('FLEET_SERVICE_URL') || 'http://localhost:3004';
    const store = getTenantStore();
    const headers: Record<string, string> = {
      'x-company-id': driver.companyId,
      ...(store?.userId ? { 'x-user-id': store.userId } : {}),
    };
    const ids = [...new Set([driver.userId, driver.id].filter(Boolean))] as string[];
    const byId = new Map<string, Record<string, unknown>>();
    for (const driverId of ids) {
      try {
        const res = await fetch(
          `${base.replace(/\/$/, '')}/loads?companyId=${encodeURIComponent(driver.companyId)}&driverId=${encodeURIComponent(driverId)}`,
          { headers },
        );
        if (!res.ok) continue;
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        for (const row of rows) {
          if (typeof row.id === 'string') byId.set(row.id, row);
        }
      } catch (e) {
        this.logger.warn(`fetch loads for performance: ${String(e)}`);
      }
    }
    return [...byId.values()] as Array<{
      status?: string;
      miles?: number;
      customerRate?: number;
      eta?: string;
      actualDelivery?: string;
    }>;
  }

  private async setLifecycle(
    id: string,
    status: DriverLifecycleStatus,
    action: string,
    reason?: string,
  ) {
    const existing = await this.ensureExists(id);
    const driver = await this.prisma.driver.update({
      where: { id },
      data: {
        lifecycleStatus: status,
        active: syncActiveFromLifecycle(status),
        employmentStatus:
          status === 'active'
            ? 'active'
            : status === 'suspended'
              ? 'suspended'
              : status === 'terminated'
                ? 'terminated'
                : existing.employmentStatus,
      },
      include: {
        documents: true,
        contracts: true,
        qualifications: true,
      },
    });
    await this.authSync.syncDriverLifecycle(driver.userId, status);
    void this.auditLifecycleChange({
      companyId: driver.companyId,
      driverId: driver.id,
      action,
      from: existing.lifecycleStatus,
      to: status,
      reason,
    });
    return this.withLegacyActive(driver);
  }

  private driverCreateData(
    data: Omit<CreateDriverDto, 'password'>,
    lifecycleStatus: DriverLifecycleStatus,
  ) {
    return {
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
      branchId: data.branchId,
      lifecycleStatus,
      active: syncActiveFromLifecycle(lifecycleStatus),
      availabilityStatus: data.availabilityStatus ?? 'available',
      driverType: data.driverType ?? 'company',
      employeeNumber: data.employeeNumber,
      employmentStatus: data.employmentStatus ?? 'active',
      hireDate: data.hireDate,
      probationEndDate: data.probationEndDate,
      seniorityDate: data.seniorityDate,
      managerUserId: data.managerUserId,
      dispatcherUserId: data.dispatcherUserId,
      preferredName: data.preferredName,
      preferredLanguage: data.preferredLanguage,
      ownerOperatorProfile: (data.ownerOperatorProfile as object) ?? undefined,
    };
  }

  private driverUpdateData(
    dto: UpdateDriverDto,
    lifecycleStatus?: DriverLifecycleStatus,
  ) {
    const data: Record<string, unknown> = {
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
      branchId: dto.branchId,
      availabilityStatus: dto.availabilityStatus,
      driverType: dto.driverType,
      employeeNumber: dto.employeeNumber,
      employmentStatus: dto.employmentStatus,
      hireDate: dto.hireDate,
      probationEndDate: dto.probationEndDate,
      seniorityDate: dto.seniorityDate,
      managerUserId: dto.managerUserId,
      dispatcherUserId: dto.dispatcherUserId,
      preferredName: dto.preferredName,
      preferredLanguage: dto.preferredLanguage,
      ownerOperatorProfile: dto.ownerOperatorProfile,
    };
    if (lifecycleStatus !== undefined) {
      data.lifecycleStatus = lifecycleStatus;
      data.active = syncActiveFromLifecycle(lifecycleStatus);
    } else if (dto.active !== undefined) {
      data.active = dto.active;
    }
    return Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );
  }

  private withLegacyActive<T extends { lifecycleStatus?: string; active?: boolean }>(
    driver: T,
  ): T {
    const lifecycleStatus =
      driver.lifecycleStatus ?? (driver.active === false ? 'suspended' : 'active');
    return {
      ...driver,
      lifecycleStatus,
      active: syncActiveFromLifecycle(lifecycleStatus),
    };
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
      const count = await this.prisma.driver.count({
        where: { companyId, lifecycleStatus: { not: 'archived' } },
      });
      if (count >= max) {
        throw new ForbiddenException(
          `Driver limit reached for plan (max ${max})`,
        );
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
    }
  }

  private async auditLifecycleChange(input: {
    companyId: string;
    driverId: string;
    action: string;
    from: string;
    to: string;
    reason?: string;
  }) {
    const store = getTenantStore();
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    try {
      await fetch(`${base.replace(/\/$/, '')}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: input.companyId,
          actorId: store?.userId || null,
          actorName: store?.email || '',
          action: input.action,
          entityType: 'driver',
          entityId: input.driverId,
          meta: {
            from: input.from,
            to: input.to,
            reason: input.reason || null,
          },
        }),
      });
    } catch (e) {
      this.logger.warn(`lifecycle audit failed: ${String(e)}`);
    }
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
