import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { TenantsService } from '../tenants/tenants.service';
import { ProvisioningService } from '../tenants/provisioning.service';
import { toTenantSlug } from '../platform/crypto.util';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { stripInternalTenantFields } from '../tenants/tenant-error.util';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly tenants: TenantsService,
    private readonly provisioning: ProvisioningService,
  ) {}

  findAll() {
    return this.prisma.company
      .findMany({
        orderBy: { name: 'asc' },
        include: {
          plan: true,
          subscription: true,
          tenantDatabase: {
            select: {
              id: true,
              dbName: true,
              status: true,
              host: true,
              port: true,
              schemaVersion: true,
              routingMode: true,
              etlStatus: true,
              writeFreeze: true,
              etlVerifiedAt: true,
              cutoverAt: true,
              archivedAt: true,
              provisionedAt: true,
              lastError: true,
              lastErrorCode: true,
              lastErrorMessage: true,
              lastErrorSeverity: true,
            },
          },
        },
      })
      .then((rows) => rows.map((c) => this.presentCompany(c)));
  }

  private presentCompany<T extends { tenantDatabase?: Record<string, unknown> | null }>(
    company: T,
  ) {
    if (!company.tenantDatabase) return company;
    return {
      ...company,
      tenantDatabase: stripInternalTenantFields(company.tenantDatabase, {
        includeTechnicalDetail: true,
      }),
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: true,
        tenantDatabase: {
          select: {
            id: true,
            dbName: true,
            status: true,
            host: true,
            port: true,
            schemaVersion: true,
            routingMode: true,
            etlStatus: true,
            writeFreeze: true,
            etlVerifiedAt: true,
            cutoverAt: true,
            archivedAt: true,
            provisionedAt: true,
            lastError: true,
            lastErrorCode: true,
            lastErrorMessage: true,
            lastErrorSeverity: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return this.presentCompany(company);
  }

  async create(dto: CreateCompanyDto) {
    const shortName = dto.shortName.trim().toUpperCase();
    let slug: string;
    try {
      slug = toTenantSlug(dto.slug?.trim() || shortName);
    } catch {
      throw new BadRequestException('Invalid company slug / short name');
    }

    const existingSlug = await this.prisma.company.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new BadRequestException(`Tenant slug "${slug}" already exists`);
    }

    const planCode = dto.planCode || 'starter';
    const plan = await this.plans.findByCode(planCode);

    const company = await this.prisma.company.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        name: dto.name.trim(),
        shortName,
        slug,
        tagline: dto.tagline,
        address: dto.address,
        active: dto.active ?? true,
        status: 'provisioning',
        planId: plan.id,
        subscription: {
          create: {
            planId: plan.id,
            status: 'active',
          },
        },
      },
      include: {
        plan: true,
        subscription: true,
      },
    });

    await this.tenants.registerPending(company.id, shortName, {
      actorName: 'superadmin',
    });

    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId: company.id,
        action: 'company.created',
        actorName: 'superadmin',
        detail: {
          slug,
          planCode: plan.code,
          dbName: `fq_tenant_${slug}`,
          phase: 2,
        },
      },
    });

    try {
      await this.provisioning.provisionCompany(company.id, {
        actorName: 'superadmin',
      });
    } catch {
      // Company row kept; status=failed — operator can retry provision
    }

    return this.findOne(company.id);
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.ensureExists(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        shortName: dto.shortName,
        tagline: dto.tagline,
        address: dto.address,
        active: dto.active,
      },
      include: {
        plan: true,
        subscription: true,
        tenantDatabase: true,
      },
    });
  }

  async toggleActive(id: string) {
    const company = await this.ensureExists(id);
    if (company.active) {
      await this.provisioning.deprovisionCompany(id, {
        actorName: 'superadmin',
      });
      await this.prisma.company.update({
        where: { id },
        data: { active: false, status: 'suspended' },
      });
    } else {
      await this.provisioning.restoreSuspendedCompany(id, {
        actorName: 'superadmin',
      });
    }
    return this.findOne(id);
  }

  async changePlan(id: string, planCode: string) {
    await this.ensureExists(id);
    const plan = await this.plans.findByCode(planCode);
    await this.prisma.company.update({
      where: { id },
      data: { planId: plan.id },
    });
    await this.prisma.subscription.upsert({
      where: { companyId: id },
      create: { companyId: id, planId: plan.id, status: 'active' },
      update: { planId: plan.id, status: 'active' },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId: id,
        action: 'subscription.changed',
        actorName: 'superadmin',
        detail: { planCode: plan.code },
      },
    });
    return this.findOne(id);
  }

  private async ensureExists(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
  }
}
