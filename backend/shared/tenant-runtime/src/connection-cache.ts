import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TenantConnectionInfo {
  companyId: string;
  tenantKey: string;
  dbName: string;
  status: string;
  schemaVersion: string;
  connectionUrl: string;
  companyStatus?: string;
  /** Phase 3: shared = stay on service DB; tenant = use fq_tenant_* */
  routingMode: 'shared' | 'tenant';
  /** Phase 4: block mutating requests while freezing shared writes */
  writeFreeze?: boolean;
  etlStatus?: string;
}

interface CacheEntry {
  expiresAt: number;
  value: TenantConnectionInfo;
}

/**
 * Resolves + caches tenant connection metadata from company-service.
 */
@Injectable()
export class TenantConnectionCache {
  private readonly logger = new Logger(TenantConnectionCache.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(private readonly config: ConfigService) {
    this.ttlMs = Number(
      this.config.get<string>('TENANT_CACHE_TTL_MS') || 60_000,
    );
  }

  invalidate(companyId: string) {
    this.cache.delete(companyId);
  }

  async resolve(companyId: string): Promise<TenantConnectionInfo | null> {
    const hit = this.cache.get(companyId);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }

    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';

    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/connection`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) {
        this.logger.warn(
          `Tenant resolve failed for ${companyId}: HTTP ${res.status}`,
        );
        return null;
      }
      const data = (await res.json()) as Record<string, unknown>;
      const value: TenantConnectionInfo = {
        companyId: String(data.companyId || companyId),
        tenantKey: String(data.tenantKey || ''),
        dbName: String(data.dbName || ''),
        status: String(data.status || ''),
        schemaVersion: String(data.schemaVersion || ''),
        connectionUrl: String(data.connectionUrl || ''),
        companyStatus: data.companyStatus
          ? String(data.companyStatus)
          : undefined,
        routingMode:
          data.routingMode === 'tenant' || data.routingMode === 'shared'
            ? data.routingMode
            : 'shared',
        writeFreeze: Boolean(data.writeFreeze),
        etlStatus: data.etlStatus ? String(data.etlStatus) : undefined,
      };
      this.cache.set(companyId, {
        expiresAt: Date.now() + this.ttlMs,
        value,
      });
      return value;
    } catch (e) {
      this.logger.warn(
        `Tenant resolve error for ${companyId}: ${String(e)}`,
      );
      return null;
    }
  }

  /** Phase 5: plan features for the company. */
  async entitlements(companyId: string): Promise<{
    features: Record<string, boolean>;
    maxDrivers: number;
    planCode: string;
  } | null> {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/companies/${encodeURIComponent(companyId)}/entitlements`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        features?: Record<string, boolean>;
        maxDrivers?: number;
        planCode?: string;
      };
      return {
        features: data.features || {},
        maxDrivers: data.maxDrivers ?? -1,
        planCode: data.planCode || 'starter',
      };
    } catch {
      return null;
    }
  }
}
