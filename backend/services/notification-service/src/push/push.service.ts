import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getTenantStore,
  requireCompanyId,
  isTenantSchemaDriftError,
  repairTenantOrgSchemas,
  tenantAls,
  TenantConnectionCache,
  type TenantStore,
} from '@tripsheet/tenant-runtime';
import type { PushStatusResponse, PushTestResponse } from '@tripsheet/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import type { RegisterPushDto, SendPushDto, UnregisterPushDto } from './dto/push.dto';
import {
  pushBodyFromEmailBody,
  pushLinkForEmailType,
  pushTitleFromEmailMeta,
  shouldMirrorEmailToPush,
  resolvePushUserIdFromEmailMeta,
} from './push-email-mirror.util';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly config: ConfigService,
    private readonly tenantCache: TenantConnectionCache,
  ) {}

  private authUser(): { userId: string; companyId: string } {
    const store = getTenantStore();
    if (!store?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    let companyId: string;
    try {
      companyId = requireCompanyId();
    } catch {
      throw new ForbiddenException(
        'Company context is required to register browser push',
      );
    }
    return { userId: store.userId, companyId };
  }

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
        `Push schema drift for company ${companyId}, running tenant repair`,
      );
      const repaired = await repairTenantOrgSchemas(companyId, {
        companyServiceUrl: this.config.get<string>('COMPANY_SERVICE_URL'),
        internalApiKey: this.config.get<string>('INTERNAL_API_KEY'),
      });
      if (!repaired) {
        throw new ServiceUnavailableException(
          'Push storage schema is out of date. Run POST /tenants/schema-migrate-all on company-service or npm run dev:sync.',
        );
      }
      try {
        return await fn();
      } catch (retryErr) {
        this.logger.error(`Push DB op failed after repair: ${String(retryErr)}`);
        throw new ServiceUnavailableException(
          'Push registration storage is unavailable. Run npm run dev:sync in /backend.',
        );
      }
    }
  }

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

  /** Mirror queued/sent email to FCM when meta includes userId (security, password reset, etc.). */
  async mirrorFromEmailLog(input: {
    companyId?: string;
    body: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    if (this.config.get<string>('PUSH_MIRROR_EMAIL') === '0') return;
    if (!this.firebase.isConfigured()) return;

    const companyId = input.companyId?.trim();
    if (!companyId) return;
    if (!shouldMirrorEmailToPush(input.meta)) return;

    const userId = resolvePushUserIdFromEmailMeta(input.meta);
    if (!userId) return;

    const type = String(input.meta?.type || 'notification.email');
    const title = pushTitleFromEmailMeta(input.meta, input.body);
    const body = pushBodyFromEmailBody(input.body);
    const link = pushLinkForEmailType(type);

    try {
      const result = await this.runWithCompanyTenant(companyId, () =>
        this.sendToUser({
          companyId,
          userId,
          title,
          body,
          data: { type, link },
        }),
      );
      if (result.sent > 0) {
        this.logger.log(
          `Push mirrored for email type=${type} userId=${userId} sent=${result.sent}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Push mirror failed type=${type} userId=${userId}: ${String(e)}`,
      );
    }
  }

  assertInternalKey(key: string | undefined): void {
    const expected =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }

  async status(): Promise<
    PushStatusResponse & { firebaseHint?: string }
  > {
    const firebaseConfigured = this.firebase.isConfigured();
    const firebaseHint = firebaseConfigured
      ? undefined
      : this.firebase.getInitHint() ||
        'Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON file path.';
    let registered = false;
    let tokenCount = 0;
    try {
      const { userId, companyId } = this.authUser();
      tokenCount = await this.withSchemaRepair(companyId, () =>
        this.prisma.fcmDevice.count({
          where: {
            companyId,
            userId,
            revokedAt: null,
          },
        }),
      );
      registered = tokenCount > 0;
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof ForbiddenException
      ) {
        throw e;
      }
      this.logger.warn(`push status failed: ${String(e)}`);
    }
    return { firebaseConfigured, registered, tokenCount, firebaseHint };
  }

  async register(dto: RegisterPushDto, userAgent?: string) {
    const { userId, companyId } = this.authUser();
    const platform = dto.platform || 'web';
    const now = new Date();
    return this.withSchemaRepair(companyId, () =>
      this.prisma.fcmDevice.upsert({
        where: { token: dto.token },
        create: {
          companyId,
          userId,
          token: dto.token,
          platform,
          userAgent: userAgent?.slice(0, 512) || null,
        },
        update: {
          companyId,
          userId,
          platform,
          userAgent: userAgent?.slice(0, 512) || null,
          revokedAt: null,
          updatedAt: now,
        },
      }),
    );
  }

  async unregister(dto: UnregisterPushDto) {
    const { userId, companyId } = this.authUser();
    const now = new Date();
    return this.withSchemaRepair(companyId, async () => {
      if (dto.token) {
        await this.prisma.fcmDevice.updateMany({
          where: { token: dto.token, companyId, userId },
          data: { revokedAt: now },
        });
        return { ok: true };
      }
      await this.prisma.fcmDevice.updateMany({
        where: { companyId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { ok: true };
    });
  }

  async sendToUser(input: SendPushDto): Promise<{ sent: number; failed: number }> {
    if (!this.firebase.isConfigured()) {
      return { sent: 0, failed: 0 };
    }

    return this.runWithCompanyTenant(input.companyId, async () => {
      const devices = await this.withSchemaRepair(input.companyId, () =>
        this.prisma.fcmDevice.findMany({
          where: {
            companyId: input.companyId,
            userId: input.userId,
            revokedAt: null,
          },
          select: { token: true },
        }),
      );

      if (devices.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const messaging = this.firebase.messaging();
      let sent = 0;
      let failed = 0;

      for (const { token } of devices) {
        try {
          await messaging.send({
            token,
            notification: {
              title: input.title,
              body: input.body,
            },
            data: input.data ?? {},
            webpush: {
              fcmOptions: {
                link: input.data?.link || '/',
              },
            },
          });
          sent += 1;
        } catch (e) {
          failed += 1;
          const msg = String(e);
          this.logger.warn(
            `FCM send failed token=${token.slice(0, 12)}… ${msg}`,
          );
          if (
            /registration-token-not-registered|invalid-registration-token/i.test(
              msg,
            )
          ) {
            await this.prisma.fcmDevice
              .updateMany({
                where: { token },
                data: { revokedAt: new Date() },
              })
              .catch(() => undefined);
          }
        }
      }

      return { sent, failed };
    });
  }

  async sendTestToCurrentUser(): Promise<PushTestResponse> {
    const { userId, companyId } = this.authUser();
    if (!this.firebase.isConfigured()) {
      return {
        sent: 0,
        failed: 0,
        reason: 'firebase_not_configured',
        hint:
          this.firebase.getInitHint() ||
          'Save Firebase service account JSON as backend/secrets/firebase-admin.json (see backend/secrets/firebase-admin.json.example), then restart notification-service.',
      };
    }

    const tokenCount = await this.withSchemaRepair(companyId, () =>
      this.prisma.fcmDevice.count({
        where: { companyId, userId, revokedAt: null },
      }),
    );

    if (tokenCount === 0) {
      return {
        sent: 0,
        failed: 0,
        reason: 'no_device_tokens',
        hint:
          'Allow browser notifications first (login prompt or user menu → Enable browser push). POST /api/push/register must succeed.',
      };
    }

    const result = await this.sendToUser({
      companyId,
      userId,
      title: 'FleetQuix',
      body: 'Web push is working.',
      data: { type: 'push.test', link: '/' },
    });

    if (result.sent > 0) {
      return { ...result, reason: 'delivered' };
    }

    return {
      ...result,
      reason: 'fcm_send_failed',
      hint:
        'FCM rejected the token. Confirm frontend VITE_FIREBASE_* and firebase-messaging-sw.js match project fleetquix-official, then disable and re-enable browser push.',
    };
  }
}
