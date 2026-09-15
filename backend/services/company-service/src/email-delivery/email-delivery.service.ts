import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyEmailDelivery } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../platform/crypto.util';
import { PatchEmailDeliveryDto } from './dto/patch-email-delivery.dto';
import { resolvePlatformFromEmail } from '../platform/platform-from.util';
import { getPlatformEmailStatus } from '../platform/platform-email-status.util';

export type ResolvedEmailDelivery = {
  companyId: string;
  active: boolean;
  mode: 'platform' | 'smtp';
  fromDisplayName: string;
  fromAddress: string;
  replyTo: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
};

@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private platformFromAddress(): string {
    return resolvePlatformFromEmail(process.env);
  }

  private normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
  }

  private assertEmail(raw: string, field: string) {
    const v = raw.trim();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
  }

  private async fetchCompanySenderEmail(companyId: string): Promise<string> {
    const authUrl = this.config.get<string>('AUTH_SERVICE_URL');
    const internalKey =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!authUrl) return '';

    try {
      const res = await fetch(
        `${authUrl.replace(/\/$/, '')}/internal/companies/${encodeURIComponent(companyId)}/sender-email`,
        { headers: { 'x-internal-api-key': internalKey } },
      );
      if (!res.ok) return '';
      const row = (await res.json()) as { email?: string } | null;
      return row?.email?.trim().toLowerCase() || '';
    } catch {
      return '';
    }
  }

  /**
   * Model A: sync company admin email as reply-to only (not From address).
   * fromEmail is reserved for Phase 2 custom-domain sends.
   */
  private async syncTenantReplyTo(
    row: CompanyEmailDelivery,
  ): Promise<CompanyEmailDelivery> {
    if (row.replyToEmail.trim()) return row;

    const adminEmail = await this.fetchCompanySenderEmail(row.companyId);
    if (!adminEmail) return row;

    return this.prisma.companyEmailDelivery.update({
      where: { companyId: row.companyId },
      data: { replyToEmail: adminEmail },
    });
  }

  async ensureForCompany(companyId: string) {
    const existing = await this.prisma.companyEmailDelivery.findUnique({
      where: { companyId },
    });
    if (existing) {
      return this.syncTenantReplyTo(existing);
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const adminEmail = await this.fetchCompanySenderEmail(companyId);
    const created = await this.prisma.companyEmailDelivery.create({
      data: {
        companyId,
        mode: 'platform',
        fromDisplayName: company.name,
        replyToEmail: adminEmail,
      },
    });
    return created;
  }

  async seedDefault(companyId: string, companyName: string) {
    const adminEmail = await this.fetchCompanySenderEmail(companyId);
    await this.prisma.companyEmailDelivery.upsert({
      where: { companyId },
      create: {
        companyId,
        mode: 'platform',
        fromDisplayName: companyName,
        replyToEmail: adminEmail,
      },
      update: {},
    });
  }

  toPublicView(
    row: Awaited<ReturnType<typeof this.ensureForCompany>>,
  ) {
    const platform = getPlatformEmailStatus(process.env);
    return {
      companyId: row.companyId,
      mode: row.mode as 'platform' | 'smtp',
      fromDisplayName: row.fromDisplayName,
      fromEmail: row.fromEmail,
      replyToEmail: row.replyToEmail,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpSecure: row.smtpSecure,
      smtpUser: row.smtpUser,
      hasSmtpPassword: Boolean(row.smtpPassCipher),
      domainVerifiedAt: row.domainVerifiedAt,
      active: row.active,
      lastTestedAt: row.lastTestedAt,
      lastTestStatus: row.lastTestStatus,
      platformFromAddress: platform.platformFromAddress || this.platformFromAddress(),
      platformEmailProvider: platform.provider,
      platformEmailReady: platform.platformReady,
      deliveryModel: 'platform_branding' as const,
      tenantReplyToEmail: row.replyToEmail,
    };
  }

  async getPublic(companyId: string) {
    const row = await this.ensureForCompany(companyId);
    return this.toPublicView(row);
  }

  async patch(companyId: string, dto: PatchEmailDeliveryDto) {
    await this.ensureForCompany(companyId);

    const mode = dto.mode;
    if (mode && mode !== 'platform' && mode !== 'smtp') {
      throw new BadRequestException('mode must be platform or smtp');
    }

    if (dto.fromEmail !== undefined) this.assertEmail(dto.fromEmail, 'fromEmail');
    if (dto.replyToEmail !== undefined) {
      this.assertEmail(dto.replyToEmail, 'replyToEmail');
    }
    if (dto.smtpUser !== undefined) this.assertEmail(dto.smtpUser, 'smtpUser');

    const current = await this.ensureForCompany(companyId);
    const nextMode = mode ?? current.mode;
    if (nextMode === 'smtp') {
      const host = dto.smtpHost ?? current.smtpHost;
      const user = dto.smtpUser ?? current.smtpUser;
      const hasPass = Boolean(
        dto.smtpPass?.trim() || current.smtpPassCipher,
      );
      if (!host || !user || !hasPass) {
        throw new BadRequestException(
          'SMTP mode requires host, user, and password',
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (mode !== undefined) data.mode = mode;
    if (dto.fromDisplayName !== undefined) {
      data.fromDisplayName = dto.fromDisplayName.trim().slice(0, 120);
    }
    if (dto.fromEmail !== undefined) {
      data.fromEmail = this.normalizeEmail(dto.fromEmail);
    }
    if (dto.replyToEmail !== undefined) {
      data.replyToEmail = this.normalizeEmail(dto.replyToEmail);
    }
    if (dto.smtpHost !== undefined) data.smtpHost = dto.smtpHost.trim();
    if (dto.smtpPort !== undefined) data.smtpPort = Number(dto.smtpPort) || 587;
    if (dto.smtpSecure !== undefined) data.smtpSecure = Boolean(dto.smtpSecure);
    if (dto.smtpUser !== undefined) data.smtpUser = this.normalizeEmail(dto.smtpUser);
    if (dto.smtpPass !== undefined && dto.smtpPass.trim()) {
      data.smtpPassCipher = encryptSecret(dto.smtpPass);
    }
    if (dto.active !== undefined) data.active = Boolean(dto.active);

    const row = await this.prisma.companyEmailDelivery.update({
      where: { companyId },
      data,
    });
    return this.toPublicView(row);
  }

  resolveFromAddress(row: CompanyEmailDelivery): string {
    if (row.mode === 'smtp') {
      return (
        row.fromEmail.trim() ||
        row.smtpUser.trim() ||
        this.platformFromAddress()
      );
    }

    // Model A: shared platform From; Phase 2 uses fromEmail only when domain verified.
    if (row.fromEmail.trim() && row.domainVerifiedAt) {
      return row.fromEmail.trim();
    }

    return this.platformFromAddress();
  }

  private resolveReplyTo(
    row: CompanyEmailDelivery,
    actingReplyTo?: string,
  ): string {
    const acting = actingReplyTo?.trim().toLowerCase();
    if (acting) return acting;
    if (row.replyToEmail.trim()) return row.replyToEmail.trim();
    return String(this.config.get<string>('PLATFORM_REPLY_TO') || '').trim();
  }

  async resolveForSend(
    companyId: string,
    actingReplyTo?: string,
  ): Promise<ResolvedEmailDelivery> {
    const row = await this.ensureForCompany(companyId);

    const fromAddress = this.resolveFromAddress(row);
    let replyTo = this.resolveReplyTo(row, actingReplyTo);
    if (!replyTo) {
      const adminEmail = await this.fetchCompanySenderEmail(companyId);
      replyTo = adminEmail;
    }

    const resolved: ResolvedEmailDelivery = {
      companyId,
      active: row.active,
      mode: row.mode as 'platform' | 'smtp',
      fromDisplayName: row.fromDisplayName.trim(),
      fromAddress,
      replyTo,
    };

    if (row.mode === 'smtp') {
      if (!row.smtpHost || !row.smtpUser || !row.smtpPassCipher) {
        throw new BadRequestException('Incomplete tenant SMTP configuration');
      }
      resolved.smtp = {
        host: row.smtpHost,
        port: row.smtpPort || 587,
        secure: row.smtpSecure,
        user: row.smtpUser,
        pass: decryptSecret(row.smtpPassCipher),
      };
    }

    return resolved;
  }

  async recordTestResult(
    companyId: string,
    status: 'sent' | 'failed' | 'queued',
  ) {
    await this.prisma.companyEmailDelivery.update({
      where: { companyId },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: status,
      },
    });
  }

  async sendTest(companyId: string, to: string) {
    const target = to.trim();
    this.assertEmail(target, 'to');

    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    if (!notifyUrl) {
      throw new BadRequestException('Notification service is not configured');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const body =
      `This is a test email from ${company.name} via FleetQuix.\n\n` +
      'If you received this message, your company email delivery settings are working.';

    const res = await fetch(`${notifyUrl.replace(/\/$/, '')}/notifications/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        channel: 'email',
        to: target,
        body,
        meta: {
          type: 'email_delivery_test',
          subject: `${company.name} — email delivery test`,
        },
      }),
    });

    let payload: { status?: string } = {};
    try {
      payload = (await res.json()) as { status?: string };
    } catch {
      payload = {};
    }

    const status = payload.status || (res.ok ? 'queued' : 'failed');
    await this.recordTestResult(
      companyId,
      status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'queued',
    );

    if (!res.ok) {
      throw new BadRequestException(
        `Test email failed (${res.status}). Check SMTP / platform email settings.`,
      );
    }

    return {
      ok: true,
      to: target,
      status,
    };
  }
}
