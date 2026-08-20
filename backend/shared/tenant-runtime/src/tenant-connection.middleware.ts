import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantConnectionCache } from './connection-cache';
import { getTenantStore, tenantAls, TenantStore } from './context';

/**
 * When routingMode=tenant, resolve connectionUrl via company-service if not already set.
 * Keeps DB URLs out of the gateway hop when possible.
 */
@Injectable()
export class TenantConnectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantConnectionMiddleware.name);

  constructor(private readonly cache: TenantConnectionCache) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const store = getTenantStore();
    if (!store) {
      next();
      return;
    }
    if (
      store.routingMode !== 'tenant' ||
      !store.companyId ||
      store.connectionUrl
    ) {
      next();
      return;
    }

    try {
      const info = await this.cache.resolve(store.companyId);
      if (info?.connectionUrl && info.status === 'active') {
        const enriched: TenantStore = {
          ...store,
          connectionUrl: info.connectionUrl,
          dbName: info.dbName || store.dbName,
          tenantKey: info.tenantKey || store.tenantKey,
          tenantStatus: info.status,
          routingMode: info.routingMode || store.routingMode,
          useTenantDb: info.routingMode === 'tenant' && info.status === 'active',
        };
        tenantAls.run(enriched, () => next());
        return;
      }
    } catch (e) {
      this.logger.warn(`Enrich connection failed: ${String(e)}`);
    }
    next();
  }
}
