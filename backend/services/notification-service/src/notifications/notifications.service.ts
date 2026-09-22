import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { PushService } from '../push/push.service';
import {
  isTenantSchemaDriftError,
  repairTenantOrgSchemas,
} from '@tripsheet/tenant-runtime';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly pushService: PushService,
  ) {}

  async findAll(companyId?: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const query = () =>
      this.prisma.notificationLog.findMany({
        where: companyId ? { companyId } : undefined,
        orderBy: { createdAt: 'desc' },
        take,
      });
    try {
      return await query();
    } catch (e) {
      if (companyId && isTenantSchemaDriftError(e)) {
        const repaired = await repairTenantOrgSchemas(companyId);
        if (repaired) {
          try {
            return await query();
          } catch (retryErr) {
            e = retryErr;
          }
        }
      }
      this.logger.error(`findAll notifications failed companyId=${companyId}`, e);
      throw new ServiceUnavailableException(
        isTenantSchemaDriftError(e)
          ? 'Notification log schema is out of date for this company. Run POST /tenants/schema-migrate-all on company-service.'
          : 'Notification log is temporarily unavailable.',
      );
    }
  }

  async log(body: Record<string, unknown>) {
    const to = String(body.to || '');
    const text = String(body.body || '');
    if (!to || !text) {
      throw new BadRequestException('to and body are required');
    }
    const channel = String(body.channel || 'email');
    if (channel === 'email') {
      const meta = { ...((body.meta as Record<string, unknown>) ?? {}) };
      if (body.replyTo && !meta.replyTo) {
        meta.replyTo = String(body.replyTo);
      }
      if (body.senderEmail && !meta.replyTo) {
        meta.replyTo = String(body.senderEmail);
      }
      const companyId = body.companyId ? String(body.companyId) : undefined;
      const logRow = await this.emailService.send({
        to,
        body: text,
        companyId,
        meta,
      });
      void this.pushService
        .mirrorFromEmailLog({ companyId, body: text, meta })
        .catch(() => undefined);
      return logRow;
    }
    return this.prisma.notificationLog.create({
      data: {
        companyId: body.companyId ? String(body.companyId) : null,
        channel,
        to,
        body: text,
        status: String(body.status || 'queued'),
        meta: (body.meta as object) ?? undefined,
      },
    });
  }

  async findOne(id: string) {
    const log = await this.prisma.notificationLog.findUnique({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return log;
  }

  async getHealthDetail() {
    const redisOk = await this.redis.ping();
    const email = this.emailService.getPlatformStatus();
    const smsEnabled = this.smsService.isTwilioConfigured();
    return {
      redis: redisOk ? 'ok' : 'down',
      smsEnabled,
      twilioConfigured: smsEnabled,
      smtpConfigured: email.smtpConfigured,
      platformEmailReady: email.platformReady,
      emailProvider: email.provider,
      platformFromAddress: email.platformFromAddress,
    };
  }
}
