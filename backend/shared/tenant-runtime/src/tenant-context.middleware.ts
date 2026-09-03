import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TENANT_HEADERS } from './headers';
import { tenantAls, TenantStore } from './context';
import { parsePermissionsHeader } from './permissions';

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

/**
 * Reads gateway-injected tenant headers into AsyncLocalStorage.
 * Services must not trust client-supplied companyId alone.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const role = header(req, TENANT_HEADERS.userRole);
    const companyId = header(req, TENANT_HEADERS.companyId);
    const routingMode =
      header(req, TENANT_HEADERS.routingMode) === 'tenant'
        ? 'tenant'
        : 'shared';
    const connectionUrl = header(req, TENANT_HEADERS.connectionUrl);
    const tenantStatus = header(req, TENANT_HEADERS.tenantStatus);

    const useTenantDb =
      routingMode === 'tenant' &&
      Boolean(connectionUrl) &&
      (tenantStatus === 'active' || !tenantStatus);

    if (role && role !== 'superadmin' && !companyId) {
      // Allow health and a few public paths without company
      const path = req.path || '';
      const publicOk =
        path.includes('/health') ||
        path.includes('/invites/by-token') ||
        /\/invites\/[^/]+\/complete/.test(path);
      if (!publicOk) {
        throw new ForbiddenException(
          'Company context required (missing x-company-id)',
        );
      }
    }

    const store: TenantStore = {
      userId: header(req, TENANT_HEADERS.userId),
      role,
      email: header(req, TENANT_HEADERS.userEmail),
      permissions: parsePermissionsHeader(
        header(req, TENANT_HEADERS.userPermissions),
      ),
      driverId: header(req, TENANT_HEADERS.driverId),
      companyId,
      tenantKey: header(req, TENANT_HEADERS.tenantKey),
      tenantStatus,
      routingMode,
      connectionUrl,
      dbName: header(req, TENANT_HEADERS.dbName),
      useTenantDb,
    };

    tenantAls.run(store, () => next());
  }
}
