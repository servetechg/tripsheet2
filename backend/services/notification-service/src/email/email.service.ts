import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryResolverService } from './email-delivery-resolver.service';
import { PlatformEmailSenderService } from './platform-email.sender.service';

export type SendEmailInput = {
  to: string;
  body: string;
  companyId?: string;
  meta?: Record<string, unknown>;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryResolver: EmailDeliveryResolverService,
    private readonly platformSender: PlatformEmailSenderService,
  ) {}

  isPlatformReady(): boolean {
    return this.platformSender.isPlatformReady();
  }

  /** @deprecated use isPlatformReady */
  isSmtpConfigured(): boolean {
    return this.platformSender.isPlatformReady();
  }

  isPlatformSmtpConfigured(): boolean {
    return this.platformSender.isSmtpRelayConfigured();
  }

  getPlatformStatus() {
    return {
      provider: this.platformSender.emailProvider(),
      smtpConfigured: this.platformSender.isSmtpRelayConfigured(),
      platformReady: this.platformSender.isPlatformReady(),
      platformFromAddress: this.platformSender.platformFromAddress(),
    };
  }

  async send(dto: SendEmailInput) {
    const subject = this.subjectFor(dto.meta, dto.body);
    const actingReplyTo = String(
      dto.meta?.replyTo || dto.meta?.senderEmail || '',
    ).trim();
    const profile = await this.deliveryResolver.resolve(
      dto.companyId,
      actingReplyTo || undefined,
    );
    let status: string;
    let providerId: string | null = null;
    let provider = this.platformSender.emailProvider();

    if (this.platformSender.canSend(profile)) {
      const result = await this.platformSender.send({
        profile,
        to: dto.to,
        subject,
        text: dto.body,
        html: this.toHtml(dto.body, profile.fromDisplayName),
      });

      provider = result.provider;
      if (result.ok) {
        status = 'sent';
        providerId = result.messageId || null;
      } else {
        status = 'failed';
        this.logger.warn(
          `Email send failed companyId=${dto.companyId || 'platform'} to=${dto.to}: ${result.error || 'unknown'}`,
        );
      }
    } else {
      status = 'queued';
      this.logger.log(
        `[Email queued — platform email not configured] companyId=${dto.companyId || 'platform'} to=${dto.to} subject=${subject}`,
      );
    }

    return this.prisma.notificationLog.create({
      data: {
        companyId: dto.companyId ?? null,
        channel: 'email',
        to: dto.to,
        body: dto.body,
        status,
        providerId,
        meta:
          dto.meta !== undefined
            ? ({
                ...dto.meta,
                emailMode: profile.mode,
                emailProvider: provider,
                fromAddress: profile.fromAddress,
              } as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  private subjectFor(
    meta: Record<string, unknown> | undefined,
    body: string,
  ): string {
    if (meta?.subject && String(meta.subject).trim()) {
      return String(meta.subject).slice(0, 200);
    }
    const type = meta?.type ? String(meta.type) : '';
    switch (type) {
      case 'password_reset':
        return 'Reset your FleetQuix password';
      case 'staff_invite':
        return 'You are invited to FleetQuix';
      case 'driver_invite':
        return 'Complete your FleetQuix driver onboarding';
      case 'security.password_changed':
        return 'Your FleetQuix password was changed';
      case 'security.login':
        return 'New sign-in to FleetQuix';
      case 'email_change':
        return 'Confirm your new FleetQuix email';
      case 'email_change_completed':
        return 'Your FleetQuix email was updated';
      case 'email_delivery_test':
        return 'FleetQuix email delivery test';
      default:
        return body.length > 60 ? `${body.slice(0, 57)}…` : body || 'FleetQuix notification';
    }
  }

  private toHtml(body: string, brandName?: string): string {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const linked = escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#2563eb">$1</a>',
    );
    const content = linked.replace(/\n/g, '<br/>');
    const brand = brandName?.trim() || 'FleetQuix';
    return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:8px;border:1px solid #e4e4e7">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e4e4e7;font-family:sans-serif;font-size:16px;font-weight:700;color:#18181b">${brand}</td></tr>
<tr><td style="padding:24px;font-family:sans-serif;font-size:14px;line-height:1.6;color:#3f3f46">${content}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e4e4e7;font-family:sans-serif;font-size:11px;color:#71717a">Sent via ${brand} on FleetQuix</td></tr>
</table></td></tr></table></body></html>`;
  }
}
