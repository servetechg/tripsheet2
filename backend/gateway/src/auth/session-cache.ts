import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SessionSnapshot = {
  tokenVersion: number;
  lockedUntil: string | null;
};

interface CacheEntry {
  expiresAt: number;
  value: SessionSnapshot;
}

/**
 * Short-TTL cache of auth-service tokenVersion / lockout for gateway checks.
 */
@Injectable()
export class SessionVersionCache {
  private readonly logger = new Logger(SessionVersionCache.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(private readonly config: ConfigService) {
    this.ttlMs = Number(
      this.config.get<string>('AUTH_SESSION_CACHE_TTL_MS') || 10_000,
    );
  }

  async get(userId: string, forceRefresh = false): Promise<SessionSnapshot | null> {
    if (!forceRefresh) {
      const hit = this.cache.get(userId);
      if (hit && hit.expiresAt > Date.now()) return hit.value;
    } else {
      this.cache.delete(userId);
    }

    const base =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/users/${encodeURIComponent(userId)}/session`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) {
        this.logger.warn(`session lookup failed for ${userId}: HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as SessionSnapshot;
      const value: SessionSnapshot = {
        tokenVersion: Number(data.tokenVersion ?? 0),
        lockedUntil: data.lockedUntil || null,
      };
      this.cache.set(userId, { value, expiresAt: Date.now() + this.ttlMs });
      return value;
    } catch (e) {
      this.logger.warn(`session lookup error: ${String(e)}`);
      return null;
    }
  }
}
