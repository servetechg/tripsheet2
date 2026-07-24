import { Injectable, NotFoundException } from '@nestjs/common';
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
