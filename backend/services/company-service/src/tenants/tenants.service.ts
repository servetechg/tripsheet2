import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptSecret,
  encryptSecret,
  tenantDbName,
  toTenantSlug,
} from '../platform/crypto.util';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  assertInternalKey(header?: string) {
    const expected =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!header || header !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }

  /** Internal: companies whose driver data lives on fq_tenant_* (for public invite lookup). */
  listTenantRoutedCompanyIds() {
    return this.prisma.tenantDatabase.findMany({
      where: { routingMode: 'tenant', status: 'active' },
      select: { companyId: true },
    });
  }

  listRegistry() {
    return this.prisma.tenantDatabase.findMany({
      select: {
        id: true,
        companyId: true,
        dbName: true,
        host: true,
        port: true,
        status: true,
        lastError: true,
        schemaVersion: true,
        routingMode: true,
        etlStatus: true,
        writeFreeze: true,
        etlVerifiedAt: true,
        cutoverAt: true,
        archivedAt: true,
        provisionedAt: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            status: true,
            active: true,
            planId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnection(companyId: string) {
    const row = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            planId: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Tenant database for ${companyId} not found`);
    }

    let connectionUrl = '';
    if (row.connectionCiphertext) {
      try {
        connectionUrl = decryptSecret(row.connectionCiphertext);
      } catch {
        throw new BadRequestException('Failed to decrypt tenant connection');
      }
    }

    return {
      companyId: row.companyId,
      tenantKey: row.company.slug,
      dbName: row.dbName,
      host: row.host,
      port: row.port,
      status: row.status,
      schemaVersion: row.schemaVersion,
      routingMode: (row.routingMode === 'tenant' ? 'tenant' : 'shared') as
        | 'shared'
        | 'tenant',
      etlStatus: row.etlStatus,
      writeFreeze: row.writeFreeze,
      etlVerifiedAt: row.etlVerifiedAt,
      cutoverAt: row.cutoverAt,
      archivedAt: row.archivedAt,
      provisionedAt: row.provisionedAt,
      /** Present only when Phase 2+ has provisioned; empty in Phase 1 */
      connectionUrl,
      planId: row.company.planId,
      companyStatus: row.company.status,
    };
  }

  async setRoutingMode(companyId: string, routingMode: 'shared' | 'tenant') {
    await this.prisma.tenantDatabase.update({
      where: { companyId },
      data: { routingMode },
    });
    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.routing_mode',
        actorName: 'system',
        detail: { routingMode, phase: 3 },
      },
    });
    return this.getConnection(companyId);
  }

  async setConnection(
    companyId: string,
    body: {
      connectionUrl?: string;
      status?: string;
      host?: string;
      port?: number;
      lastError?: string;
    },
  ) {
    const existing = await this.prisma.tenantDatabase.findUnique({
      where: { companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Tenant database for ${companyId} not found`);
    }

    const data: Record<string, unknown> = {};
    if (body.connectionUrl !== undefined) {
      data.connectionCiphertext = body.connectionUrl
        ? encryptSecret(body.connectionUrl)
        : '';
    }
    if (body.status) data.status = body.status;
    if (body.host) data.host = body.host;
    if (body.port !== undefined) data.port = body.port;
    if (body.lastError !== undefined) data.lastError = body.lastError;
    if (body.status === 'active') data.provisionedAt = new Date();

    const updated = await this.prisma.tenantDatabase.update({
      where: { companyId },
      data,
    });

    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.connection.updated',
        actorName: 'system',
        detail: {
          status: updated.status,
          dbName: updated.dbName,
          hasConnection: Boolean(updated.connectionCiphertext),
        },
      },
    });

    return {
      companyId,
      dbName: updated.dbName,
      status: updated.status,
      provisionedAt: updated.provisionedAt,
    };
  }

  /** Register pending tenant DB row for a new/existing company (Phase 1). */
  async registerPending(companyId: string, shortName: string, actor?: {
    actorId?: string;
    actorName?: string;
  }) {
    const slug = toTenantSlug(shortName);
    const dbName = tenantDbName(slug);
    const host =
      this.config.get<string>('TENANT_DB_HOST') ||
      this.config.get<string>('POSTGRES_HOST') ||
      'localhost';
    const port = Number(this.config.get<string>('TENANT_DB_PORT') || 5432);

    const row = await this.prisma.tenantDatabase.upsert({
      where: { companyId },
      create: {
        companyId,
        dbName,
        host,
        port,
        status: 'pending_provision',
        connectionCiphertext: '',
        schemaVersion: '1',
      },
      update: {
        dbName,
        host,
        port,
      },
    });

    await this.prisma.tenantLifecycleEvent.create({
      data: {
        companyId,
        action: 'tenant.registry.created',
        actorId: actor?.actorId,
        actorName: actor?.actorName || 'system',
        detail: { dbName, slug, phase: 1 },
      },
    });

    return row;
  }
}
