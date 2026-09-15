import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { ResolvedEmailProfile } from './email-delivery-resolver.service';
import { resolvePlatformFromEmail } from '../platform/platform-from.util';

export type PlatformSendInput = {
  profile: ResolvedEmailProfile;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type PlatformSendResult = {
  ok: boolean;
  provider: 'smtp' | 'none';
  messageId?: string;
  error?: string;
};

@Injectable()
export class PlatformEmailSenderService {
  private readonly logger = new Logger(PlatformEmailSenderService.name);
  private smtpTransporter: Transporter | null = null;
  private tenantTransporters = new Map<string, Transporter>();

  constructor(private readonly config: ConfigService) {
    if (this.isSmtpRelayConfigured()) {
      this.smtpTransporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST')!,
        port: Number(this.config.get<string>('SMTP_PORT') || 587),
        secure:
          this.config.get<string>('SMTP_SECURE') === 'true' ||
          Number(this.config.get<string>('SMTP_PORT') || 0) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER')!,
          pass: this.config.get<string>('SMTP_PASS')!,
        },
      });
    }
  }

  emailProvider(): 'smtp' | 'none' {
    return this.isSmtpRelayConfigured() ? 'smtp' : 'none';
  }

  isSmtpRelayConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST') &&
        this.config.get<string>('SMTP_USER') &&
        this.config.get<string>('SMTP_PASS') &&
        resolvePlatformFromEmail(process.env),
    );
  }

  isPlatformReady(): boolean {
    return this.isSmtpRelayConfigured();
  }

  platformFromAddress(): string {
    return resolvePlatformFromEmail(process.env);
  }

  private formatFrom(
    profile: ResolvedEmailProfile,
  ): string | { name: string; address: string } {
    const address =
      profile.fromAddress ||
      this.platformFromAddress() ||
      this.config.get<string>('SMTP_FROM') ||
      '';
    const name = profile.fromDisplayName?.trim();
    if (name && address) {
      return { name, address };
    }
    return address;
  }

  private tenantTransporter(profile: ResolvedEmailProfile): Transporter | null {
    if (profile.mode !== 'smtp' || !profile.smtp || !profile.companyId) {
      return null;
    }
    const key = profile.companyId;
    const cached = this.tenantTransporters.get(key);
    if (cached) return cached;

    const smtp = profile.smtp;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    this.tenantTransporters.set(key, transporter);
    return transporter;
  }

  canSend(profile: ResolvedEmailProfile): boolean {
    if (profile.mode === 'smtp') {
      return Boolean(profile.smtp?.host && profile.smtp.user && profile.smtp.pass);
    }
    return this.isPlatformReady();
  }

  async send(input: PlatformSendInput): Promise<PlatformSendResult> {
    const { profile } = input;

    if (profile.mode === 'smtp') {
      return this.sendTenantSmtp(input);
    }

    if (this.isSmtpRelayConfigured() && this.smtpTransporter) {
      return this.sendPlatformSmtp(input);
    }

    return { ok: false, provider: 'none', error: 'SMTP not configured' };
  }

  private async sendPlatformSmtp(
    input: PlatformSendInput,
  ): Promise<PlatformSendResult> {
    if (!this.smtpTransporter) {
      return { ok: false, provider: 'smtp', error: 'SMTP transporter unavailable' };
    }

    try {
      const mail: SendMailOptions = {
        from: this.formatFrom(input.profile),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      };
      if (input.profile.replyTo) {
        mail.replyTo = input.profile.replyTo;
      }

      const info = await this.smtpTransporter.sendMail(mail);
      return { ok: true, provider: 'smtp', messageId: info.messageId || undefined };
    } catch (err) {
      const msg = String(err);
      this.logger.warn(`Platform SMTP failed to=${input.to}: ${msg}`);
      return { ok: false, provider: 'smtp', error: msg };
    }
  }

  private async sendTenantSmtp(
    input: PlatformSendInput,
  ): Promise<PlatformSendResult> {
    const transporter = this.tenantTransporter(input.profile);
    if (!transporter) {
      return { ok: false, provider: 'smtp', error: 'Tenant SMTP not configured' };
    }

    try {
      const mail: SendMailOptions = {
        from: this.formatFrom(input.profile),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      };
      if (input.profile.replyTo) {
        mail.replyTo = input.profile.replyTo;
      }

      const info = await transporter.sendMail(mail);
      return { ok: true, provider: 'smtp', messageId: info.messageId || undefined };
    } catch (err) {
      const msg = String(err);
      this.logger.warn(
        `Tenant SMTP failed companyId=${input.profile.companyId} to=${input.to}: ${msg}`,
      );
      return { ok: false, provider: 'smtp', error: msg };
    }
  }
}
