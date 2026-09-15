import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isPersonalSmtpFrom,
  resolvePlatformFromEmail,
} from '../platform/platform-from.util';

export type ResolvedEmailProfile = {
  companyId?: string;
  active?: boolean;
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

type CacheEntry = {
  profile: ResolvedEmailProfile;
  expiresAt: number;
};

@Injectable()
export class EmailDeliveryResolverService {
  private readonly logger = new Logger(EmailDeliveryResolverService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  private cacheTtlMs(): number {
    return Number(this.config.get<string>('EMAIL_PROFILE_CACHE_TTL_MS') || 60_000);
  }

  private platformDefaults(): ResolvedEmailProfile {
    const fromAddress = resolvePlatformFromEmail(process.env);
    if (isPersonalSmtpFrom(process.env)) {
      this.logger.warn(
        'SMTP_FROM matches SMTP_USER (personal mailbox). Set PLATFORM_FROM_EMAIL to a product-domain noreply address (e.g. noreply@yourdomain.com) via SendGrid/SES/Mailgun.',
      );
    }
    return {
      mode: 'platform',
      fromDisplayName: String(
        this.config.get<string>('PLATFORM_EMAIL_FROM_NAME') || 'FleetQuix',
      ),
      fromAddress,
      replyTo: String(this.config.get<string>('PLATFORM_REPLY_TO') || ''),
    };
  }

  private fromCache(companyId: string): ResolvedEmailProfile | null {
    const hit = this.cache.get(companyId);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.cache.delete(companyId);
      return null;
    }
    return hit.profile;
  }

  private putCache(companyId: string, profile: ResolvedEmailProfile) {
    this.cache.set(companyId, {
      profile,
      expiresAt: Date.now() + this.cacheTtlMs(),
    });
  }

  invalidate(companyId: string) {
    this.cache.delete(companyId);
  }

  async resolve(
    companyId?: string,
    actingReplyTo?: string,
  ): Promise<ResolvedEmailProfile> {
    if (!companyId) return this.platformDefaults();

    const cacheKey = actingReplyTo
      ? `${companyId}:${actingReplyTo.toLowerCase()}`
      : companyId;
    const cached = this.fromCache(cacheKey);
    if (cached) return cached;

    const base = this.platformDefaults();
    const companyUrl = this.config.get<string>('COMPANY_SERVICE_URL');
    const internalKey =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';

    if (!companyUrl) {
      this.logger.debug(
        `COMPANY_SERVICE_URL unset — using platform email for companyId=${companyId}`,
      );
      return base;
    }

    const qs = actingReplyTo
      ? `?replyTo=${encodeURIComponent(actingReplyTo.trim())}`
      : '';

    try {
      const res = await fetch(
        `${companyUrl.replace(/\/$/, '')}/internal/companies/${encodeURIComponent(companyId)}/email-delivery${qs}`,
        {
          headers: { 'x-internal-api-key': internalKey },
        },
      );

      if (!res.ok) {
        this.logger.warn(
          `email-delivery lookup failed companyId=${companyId} status=${res.status}`,
        );
        return base;
      }

      const row = (await res.json()) as {
        companyId: string;
        active: boolean;
        mode: 'platform' | 'smtp';
        fromDisplayName: string;
        fromAddress: string;
        replyTo: string;
        smtp?: ResolvedEmailProfile['smtp'];
      };

      if (row.active === false) {
        return base;
      }

      const profile: ResolvedEmailProfile = {
        companyId: row.companyId,
        active: row.active,
        mode: row.mode,
        fromDisplayName: row.fromDisplayName || base.fromDisplayName,
        fromAddress: row.fromAddress || base.fromAddress,
        replyTo: row.replyTo || base.replyTo,
        smtp: row.smtp,
      };

      this.putCache(cacheKey, profile);
      return profile;
    } catch (err) {
      this.logger.warn(
        `email-delivery lookup error companyId=${companyId}: ${String(err)}`,
      );
      return base;
    }
  }
}
