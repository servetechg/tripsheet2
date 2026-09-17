import { BadRequestException } from '@nestjs/common';
import { SmsService } from './sms.service';

const messagesCreate = jest.fn();

jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: { create: messagesCreate },
  }));
});

function twilioConfig() {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, string | undefined> = {
        TWILIO_ACCOUNT_SID: 'AC_test',
        TWILIO_AUTH_TOKEN: 'auth_test',
        TWILIO_FROM_NUMBER: '+15550001111',
      };
      return values[key];
    }),
  };
}

describe('SmsService', () => {
  let service: SmsService;
  let prisma: {
    notificationLog: {
      create: jest.Mock;
    };
  };
  let redis: {
    incr: jest.Mock;
    expire: jest.Mock;
  };
  let config: {
    get: jest.Mock;
  };

  beforeEach(() => {
    messagesCreate.mockReset();
    prisma = {
      notificationLog: {
        create: jest.fn(),
      },
    };
    redis = {
      incr: jest.fn(),
      expire: jest.fn(),
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | undefined> = {
          TWILIO_ACCOUNT_SID: undefined,
          TWILIO_AUTH_TOKEN: undefined,
          TWILIO_FROM_NUMBER: undefined,
        };
        return values[key];
      }),
    };
    service = new SmsService(prisma as any, redis as any, config as any);
  });

  describe('send', () => {
    it('rejects SMS when Twilio is not configured', async () => {
      await expect(
        service.send({
          to: '+15551234567',
          body: 'Hello',
          companyId: 'c1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when rate limit is exceeded', async () => {
      service = new SmsService(prisma as any, redis as any, twilioConfig() as any);
      redis.incr.mockResolvedValue(21);

      await expect(
        service.send({
          to: '+15551234567',
          body: 'Over limit',
          companyId: 'c1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('uses global scope when companyId is omitted', async () => {
      service = new SmsService(prisma as any, redis as any, twilioConfig() as any);
      redis.incr.mockResolvedValue(21);

      await expect(
        service.send({
          to: '+15551234567',
          body: 'Over limit',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(redis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^sms:rl:global:\d{4}-\d{2}-\d{2}-\d{2}$/),
      );
    });
  });
});
