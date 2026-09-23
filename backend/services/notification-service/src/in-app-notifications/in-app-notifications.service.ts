import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getTenantStore,
  isTenantSchemaDriftError,
  repairTenantOrgSchemas,
  requireCompanyId,
  tenantAls,
  TenantConnectionCache,
  type TenantStore,
} from '@tripsheet/tenant-runtime';
import type {
  InAppNotification,
  InAppNotificationListResponse,
} from '@tripsheet/shared';
import { PrismaService } from '../prisma/prisma.service';
import { InAppRealtimePublisher } from './in-app-realtime.publisher';

function mapRow(row: {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  readAt: Date | null;
  createdAt: Date;
}): InAppNotification {
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    title: row.title,
    body: row.body,
    link: row.link,
    type: row.type,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: InAppRealtimePublisher,
    private readonly tenantCache: TenantConnectionCache,
    private readonly config: ConfigService,
  ) {}

  /** Same auto-repair as push (020_in_app_notifications on tenant DB). */
  private async withSchemaRepair<T>(
    companyId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (!isTenantSchemaDriftError(e)) {
        throw e;
      }
      this.logger.warn(
        `In-app schema drift for company ${companyId}, running tenant repair`,
      );
      const repaired = await repairTenantOrgSchemas(companyId, {
        companyServiceUrl: this.config.get<string>('COMPANY_SERVICE_URL'),
        internalApiKey: this.config.get<string>('INTERNAL_API_KEY'),
      });
      if (!repaired) {
        throw new ServiceUnavailableException(
          'In-app inbox schema is out of date. Run npm run dev:sync in /backend.',
        );
      }
      return await fn();
    }
  }

  private authContext(): { userId: string; companyId: string } {
    const store = getTenantStore();
    if (!store?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    let companyId: string;
    try {
      companyId = requireCompanyId();
    } catch {
      throw new ForbiddenException('Company context is required');
    }
    return { userId: store.userId, companyId };
  }

  /** Same tenant DB routing as push (email/login hooks have no gateway tenant headers). */
  private async runWithCompanyTenant<T>(
    companyId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const store = getTenantStore();
    if (
      store?.useTenantDb &&
      store.companyId === companyId &&
      store.connectionUrl
    ) {
      return fn();
    }

    const info = await this.tenantCache.resolve(companyId);
    if (
      !info?.connectionUrl ||
      info.routingMode !== 'tenant' ||
      info.status !== 'active'
    ) {
      return fn();
    }

    const tenantStore: TenantStore = {
      companyId,
      routingMode: 'tenant',
      connectionUrl: info.connectionUrl,
      dbName: info.dbName,
      tenantKey: info.tenantKey,
      tenantStatus: info.status,
      useTenantDb: true,
    };
    return tenantAls.run(tenantStore, fn);
  }

  private async listInTenantDb(
    userId: string,
    companyId: string,
    take: number,
  ): Promise<InAppNotificationListResponse> {
    const unreadWhere = { userId, companyId, readAt: null };
    const [unreadRows, unreadCount] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where: unreadWhere,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inAppNotification.count({ where: unreadWhere }),
    ]);

    const unreadSlice = unreadRows.slice(0, take);
    const readSlots = Math.max(0, take - unreadSlice.length);
    const readRows =
      readSlots > 0
        ? await this.prisma.inAppNotification.findMany({
            where: { userId, companyId, readAt: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: readSlots,
          })
        : [];

    const seen = new Set<string>();
    const merged = [...unreadSlice, ...readRows].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    return {
      items: merged.map(mapRow),
      unreadCount,
    };
  }

  async listMine(limit = 40): Promise<InAppNotificationListResponse> {
    const { userId, companyId } = this.authContext();
    const take = Math.min(Math.max(limit, 1), 100);
    return this.runWithCompanyTenant(companyId, () =>
      this.withSchemaRepair(companyId, () =>
        this.listInTenantDb(userId, companyId, take),
      ),
    );
  }

  async markRead(id: string): Promise<InAppNotification> {
    const { userId, companyId } = this.authContext();
    return this.runWithCompanyTenant(companyId, () =>
      this.withSchemaRepair(companyId, async () => {
        const row = await this.prisma.inAppNotification.findFirst({
          where: { id, userId, companyId },
        });
        if (!row) {
          throw new NotFoundException('Notification not found');
        }
        const updated = row.readAt
          ? row
          : await this.prisma.inAppNotification.update({
              where: { id },
              data: { readAt: new Date() },
            });
        return mapRow(updated);
      }),
    );
  }

  async markAllRead(): Promise<{ updated: number }> {
    const { userId, companyId } = this.authContext();
    return this.runWithCompanyTenant(companyId, () =>
      this.withSchemaRepair(companyId, async () => {
        const result = await this.prisma.inAppNotification.updateMany({
          where: { userId, companyId, readAt: null },
          data: { readAt: new Date() },
        });
        return { updated: result.count };
      }),
    );
  }

  async notifyUser(input: {
    companyId: string;
    userId: string;
    title: string;
    body: string;
    link?: string | null;
    type?: string;
    meta?: Record<string, unknown>;
  }): Promise<InAppNotification | null> {
    const companyId = input.companyId?.trim();
    const userId = input.userId?.trim();
    const title = input.title?.trim();
    const body = input.body?.trim();
    if (!companyId || !userId || !title || !body) {
      return null;
    }

    return this.runWithCompanyTenant(companyId, () =>
      this.withSchemaRepair(companyId, async () => {
        const row = await this.prisma.inAppNotification.create({
          data: {
            companyId,
            userId,
            title,
            body,
            link: input.link ?? null,
            type: input.type ?? 'general',
            meta: input.meta ? (input.meta as object) : undefined,
          },
        });

        const unreadCount = await this.prisma.inAppNotification.count({
          where: { userId, companyId, readAt: null },
        });

        const notification = mapRow(row);
        this.realtime.publishToUser(userId, { notification, unreadCount });
        this.logger.log(
          `In-app saved type=${notification.type} userId=${userId} companyId=${companyId}`,
        );
        return notification;
      }),
    );
  }
}
