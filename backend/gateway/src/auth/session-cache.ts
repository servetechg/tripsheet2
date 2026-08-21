import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SessionSnapshot = {
  tokenVersion: number;
  lockedUntil: string | null;
  status?: string | null;
  authAllowed?: boolean;
  sessionActive?: boolean;
};

interface CacheEntry {
  expiresAt: number;
  value: SessionSnapshot;
}

/**
 * Short-TTL cache of auth-service tokenVersion / lockout / session for gateway checks.
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

  private cacheKey(userId: string, sessionId?: string | null) {
    return sessionId ? `${userId}:${sessionId}` : userId;
  }

  async get(
    userId: string,
    forceRefresh = false,
    sessionId?: string | null,
  ): Promise<SessionSnapshot | null> {
    const key = this.cacheKey(userId, sessionId);
    if (!forceRefresh) {
      const hit = this.cache.get(key);
      if (hit && hit.expiresAt > Date.now()) return hit.value;
    } else {
      this.cache.delete(key);
    }

    const base =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const apiKey =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const q = sessionId
        ? `?sid=${encodeURIComponent(sessionId)}`
        : '';
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/users/${encodeURIComponent(userId)}/session${q}`,
        { headers: { 'x-internal-api-key': apiKey } },
      );
      if (!res.ok) {
        this.logger.warn(`session lookup failed for ${userId}: HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as SessionSnapshot;
      const value: SessionSnapshot = {
        tokenVersion: Number(data.tokenVersion ?? 0),
        lockedUntil: data.lockedUntil || null,
        status: data.status ?? null,
        sessionActive:
          data.sessionActive !== undefined ? Boolean(data.sessionActive) : true,
        authAllowed:
          data.authAllowed !== undefined
            ? Boolean(data.authAllowed)
            : data.status
              ? data.status === 'active'
              : true,
      };
      this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
      return value;
    } catch (e) {
      this.logger.warn(`session lookup error: ${String(e)}`);
      return null;
    }
  }
}
