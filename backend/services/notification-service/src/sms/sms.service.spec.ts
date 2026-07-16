import { BadRequestException } from '@nestjs/common';
import { SmsService } from './sms.service';

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
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
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
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    service = new SmsService(prisma as any, redis as any, config as any);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('send', () => {
    it('simulates SMS without Twilio credentials', async () => {
      redis.incr.mockResolvedValue(1);
      redis.expire.mockResolvedValue(undefined);
      prisma.notificationLog.create.mockResolvedValue({
        id: 'n1',
        status: 'simulated',
        to: '+15551234567',
        body: 'Hello',
      });

      const result = await service.send({
        to: '+15551234567',
        body: 'Hello',
        companyId: 'c1',
      });

      expect(result.status).toBe('simulated');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SMS simulated] to=+15551234567 body=Hello',
      );
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'c1',
          channel: 'sms',
          to: '+15551234567',
          body: 'Hello',
          status: 'simulated',
          providerId: null,
        }),
      });
      expect(redis.incr).toHaveBeenCalled();
      expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 3600);
    });

    it('throws BadRequestException when rate limit is exceeded', async () => {
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
