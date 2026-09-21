import { EmailService } from './email.service';
import type { EmailDeliveryResolverService } from './email-delivery-resolver.service';
import type { PlatformEmailSenderService } from './platform-email.sender.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: {
    notificationLog: {
      create: jest.Mock;
    };
  };
  let deliveryResolver: { resolve: jest.Mock };
  let platformSender: {
    isPlatformReady: jest.Mock;
    isSmtpRelayConfigured: jest.Mock;
    emailProvider: jest.Mock;
    canSend: jest.Mock;
    send: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      notificationLog: {
        create: jest.fn(),
      },
    };
    deliveryResolver = {
      resolve: jest.fn().mockResolvedValue({
        mode: 'platform',
        fromAddress: 'noreply@example.com',
        fromDisplayName: 'FleetQuix',
      }),
    };
    platformSender = {
      isPlatformReady: jest.fn(() => false),
      isSmtpRelayConfigured: jest.fn(() => false),
      emailProvider: jest.fn(() => 'none'),
      canSend: jest.fn(() => false),
      send: jest.fn(),
    };
    service = new EmailService(
      prisma as unknown as PrismaService,
      deliveryResolver as unknown as EmailDeliveryResolverService,
      platformSender as unknown as PlatformEmailSenderService,
    );
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
