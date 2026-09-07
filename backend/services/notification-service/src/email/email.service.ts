import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export type SendEmailInput = {
  to: string;
  body: string;
  companyId?: string;
  meta?: Record<string, unknown>;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    if (this.isSmtpConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST')!,
        port: Number(this.config.get<string>('SMTP_PORT') || 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER')!,
          pass: this.config.get<string>('SMTP_PASS')!,
        },
      });
    }
  }

  isSmtpConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST') &&
        this.config.get<string>('SMTP_USER') &&
        this.config.get<string>('SMTP_PASS') &&
        this.config.get<string>('SMTP_FROM'),
    );
  }

  async send(dto: SendEmailInput) {
    const subject = this.subjectFor(dto.meta, dto.body);
    let status: string;
    let providerId: string | null = null;

    if (this.isSmtpConfigured() && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.config.get<string>('SMTP_FROM')!,
          to: dto.to,
          subject,
          text: dto.body,
          html: this.toHtml(dto.body),
        });
        status = 'sent';
        providerId = info.messageId || null;
      } catch (err) {
        status = 'failed';
        this.logger.warn(`SMTP send failed to=${dto.to}: ${String(err)}`);
      }
    } else {
      status = 'queued';
      this.logger.log(
        `[Email queued — SMTP not configured] to=${dto.to} subject=${subject}`,
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
            ? (dto.meta as Prisma.InputJsonValue)
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
      default:
        return body.length > 60 ? `${body.slice(0, 57)}…` : body || 'FleetQuix notification';
    }
  }

  private toHtml(body: string): string {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const linked = escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1">$1</a>',
    );
    return `<p style="font-family:sans-serif;line-height:1.5">${linked.replace(/\n/g, '<br/>')}</p>`;
  }
}
