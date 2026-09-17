import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import twilio from 'twilio';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SendSmsDto } from './dto/send-sms.dto';

const SMS_RATE_LIMIT = 20;
const SMS_RATE_LIMIT_TTL_SECONDS = 3600;

export const SMS_DISABLED_MESSAGE =
  'SMS is disabled until Twilio is configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).';

@Injectable()
export class SmsService {
  private twilioClient: ReturnType<typeof twilio> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    if (this.isTwilioConfigured()) {
      this.twilioClient = twilio(
        this.config.get<string>('TWILIO_ACCOUNT_SID')!,
        this.config.get<string>('TWILIO_AUTH_TOKEN')!,
      );
    }
  }

  isTwilioConfigured(): boolean {
    return Boolean(
      this.config.get<string>('TWILIO_ACCOUNT_SID') &&
        this.config.get<string>('TWILIO_AUTH_TOKEN') &&
        this.config.get<string>('TWILIO_FROM_NUMBER'),
    );
  }

  async send(dto: SendSmsDto) {
    if (!this.isTwilioConfigured() || !this.twilioClient) {
      throw new BadRequestException(SMS_DISABLED_MESSAGE);
    }

    await this.enforceRateLimit(dto.companyId);

    let status: string;
    let providerId: string | null = null;

    try {
      const message = await this.twilioClient.messages.create({
        to: dto.to,
        from: this.config.get<string>('TWILIO_FROM_NUMBER')!,
        body: dto.body,
      });
      status = 'sent';
      providerId = message.sid;
    } catch {
      status = 'failed';
    }

    return this.prisma.notificationLog.create({
      data: {
        companyId: dto.companyId,
        channel: 'sms',
        to: dto.to,
        body: dto.body,
        status,
        providerId,
        meta:
          dto.meta !== undefined
            ? (dto.meta as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  private async enforceRateLimit(companyId?: string) {
    const scope = companyId ?? 'global';
    const hourKey = this.currentHourKey();
    const rateLimitKey = `sms:rl:${scope}:${hourKey}`;

    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) {
      await this.redis.expire(rateLimitKey, SMS_RATE_LIMIT_TTL_SECONDS);
    }
    if (count > SMS_RATE_LIMIT) {
      throw new BadRequestException(
        `SMS rate limit exceeded (max ${SMS_RATE_LIMIT} per hour for ${scope})`,
      );
    }
  }

  private currentHourKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }
}
