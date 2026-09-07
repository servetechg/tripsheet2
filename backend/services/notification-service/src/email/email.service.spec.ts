import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: {
    notificationLog: {
      create: jest.Mock;
    };
  };
  let config: {
    get: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      notificationLog: {
        create: jest.fn(),
      },
    };
    config = {
      get: jest.fn(() => undefined),
    };
    service = new EmailService(prisma as any, config as any);
  });

  it('queues email when SMTP is not configured', async () => {
    prisma.notificationLog.create.mockResolvedValue({
      id: 'n1',
      status: 'queued',
      channel: 'email',
    });

    const result = await service.send({
      to: 'user@example.com',
      body: 'Reset your password: http://localhost/reset',
      meta: { type: 'password_reset' },
    });

    expect(result.status).toBe('queued');
    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'email',
        to: 'user@example.com',
        status: 'queued',
      }),
    });
  });

  it('isSmtpConfigured is false without credentials', () => {
    expect(service.isSmtpConfigured()).toBe(false);
  });
});
