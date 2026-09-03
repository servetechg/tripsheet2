import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly smsService: SmsService,
  ) {}

  findAll(companyId?: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    return this.prisma.notificationLog.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async log(body: Record<string, unknown>) {
    const to = String(body.to || '');
    const text = String(body.body || '');
    if (!to || !text) {
      throw new BadRequestException('to and body are required');
    }
    return this.prisma.notificationLog.create({
      data: {
        companyId: body.companyId ? String(body.companyId) : null,
        channel: String(body.channel || 'email'),
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
    return {
      redis: redisOk ? 'ok' : 'down',
      twilioConfigured: this.smsService.isTwilioConfigured(),
    };
  }
}
