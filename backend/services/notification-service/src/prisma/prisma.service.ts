import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { createTenantPrismaProxy } from '@tripsheet/tenant-runtime';

export interface PrismaService extends PrismaClient {}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly shared: PrismaClient;
  private readonly pools = new Map<string, PrismaClient>();

  constructor(config: ConfigService) {
    this.shared = new PrismaClient();
    const schema = config.get<string>('TENANT_DB_SCHEMA') || 'notification';
    // eslint-disable-next-line no-constructor-return -- Nest uses returned proxy instance
    return createTenantPrismaProxy(this, {
      schema,
      shared: this.shared,
      pools: this.pools,
      createClient: (url) =>
        new PrismaClient({ datasources: { db: { url } } }),
    }) as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.shared.$connect();
  }

  async onModuleDestroy() {
    await this.shared.$disconnect();
    await Promise.all(
      [...this.pools.values()].map((c) => c.$disconnect().catch(() => undefined)),
    );
  }
}