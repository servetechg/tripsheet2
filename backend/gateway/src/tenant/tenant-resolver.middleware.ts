import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { TenantConnectionCache } from '@tripsheet/tenant-runtime';
import { SessionVersionCache } from '../auth/session-cache';

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  companyId?: string | null;
  tenantKey?: string | null;
  permissions?: string[];
  driverId?: string | null;
  tv?: number;
  sid?: string;
};

const PUBLIC_PATHS: RegExp[] = [
  /^\/health$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/refresh$/,
  /^\/api\/auth\/mfa\/challenge$/,
  /^\/api\/auth\/mfa\/enroll-login\/start$/,
  /^\/api\/auth\/mfa\/enroll-login\/confirm$/,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/invites\/by-token\//,
  /^\/api\/invites\/[^/]+\/complete$/,
];

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);

  constructor(
    private readonly config: ConfigService,
    private readonly tenants: TenantConnectionCache,
    private readonly sessions: SessionVersionCache,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const path = (req.originalUrl || req.url || req.path || '')
      .split('?')[0]
      .replace(/\/+$/, '') || '/';

    if (PUBLIC_PATHS.some((re) => re.test(path))) {
      next();
      return;
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const secret =
      this.config.get<string>('JWT_SECRET') || 'change-me-in-production';
    let payload: JwtPayload;
    try {
      payload = jwt.verify(auth.slice(7), secret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.sub) {
      let session = await this.sessions.get(payload.sub, false, payload.sid);
      const jwtTv = Number(payload.tv ?? 0);
      if (session && session.tokenVersion !== jwtTv) {
        session = await this.sessions.get(payload.sub, true, payload.sid);
      }
      if (session) {
        if (session.authAllowed === false) {
          throw new UnauthorizedException(
            session.sessionActive === false
              ? 'Session revoked. Sign in again.'
              : session.status === 'suspended'
                ? 'Account suspended'
                : session.status === 'archived'
                  ? 'Account archived'
                  : session.status === 'locked'
                    ? 'Account locked'
                    : 'Account not allowed to sign in',
          );
        }
        if (
          session.lockedUntil &&
          Date.parse(session.lockedUntil) > Date.now()
        ) {
          throw new UnauthorizedException('Account locked. Try again later.');
        }
        if (session.tokenVersion !== jwtTv) {
          throw new UnauthorizedException('Token revoked. Sign in again.');
        }
      }
    }

    const role = payload.role || '';
    const companyId = payload.companyId || undefined;
    let tenantKey = payload.tenantKey || undefined;
    let routingMode: 'tenant' = 'tenant';
    let tenantStatus = '';
    let dbName = '';

    if (role !== 'superadmin') {
      if (!companyId) {
        throw new ForbiddenException('Token missing companyId');
      }
      const info = await this.tenants.resolve(companyId);
      if (!info) {
        this.logger.warn(`No tenant registry row for ${companyId}`);
        throw new ForbiddenException('Company tenant is not registered');
      }
      if (info.companyStatus === 'suspended' || info.status === 'suspended') {
        throw new ForbiddenException('Company suspended');
      }
      if (info.status !== 'active') {
        throw new ForbiddenException(
          'Company tenant database is not ready yet. Try again after provisioning completes.',
        );
      }
      tenantKey = info.tenantKey || tenantKey;
      tenantStatus = info.status;
      dbName = info.dbName;
    } else if (companyId) {
      const info = await this.tenants.resolve(companyId);
      if (info?.status === 'active') {
        routingMode = 'tenant';
        tenantKey = info.tenantKey;
        tenantStatus = info.status;
        dbName = info.dbName;
      }
    }

    // Phase 5: subscription feature gates (accounting, apiAccess surface)
    if (companyId && role !== 'superadmin') {
      const needsAccounting =
        /^\/api\/(invoices|bills|payments|accounts|settlements)(\/|$)/.test(
          path,
        );
      if (needsAccounting) {
        const ent = await this.tenants.entitlements(companyId);
        if (ent && ent.features.accounting === false) {
          throw new ForbiddenException(
            'Accounting is not included in your plan — upgrade to Professional or Enterprise',
          );
        }
      }
    }

    // Strip any client-spoofed tenant headers, then inject trusted ones
    const strip = [
      'x-user-id',
      'x-user-role',
      'x-user-email',
      'x-user-permissions',
      'x-driver-id',
      'x-company-id',
      'x-tenant-key',
      'x-tenant-status',
      'x-tenant-routing',
      'x-tenant-connection-url',
      'x-tenant-db-name',
    ];
    for (const h of strip) {
      delete req.headers[h];
    }

    req.headers['x-user-id'] = payload.sub;
    if (payload.email) req.headers['x-user-email'] = payload.email;
    if (role) req.headers['x-user-role'] = role;
    if (payload.permissions?.length) {
      req.headers['x-user-permissions'] = payload.permissions.join(',');
    }
    if (payload.driverId) req.headers['x-driver-id'] = payload.driverId;
    if (companyId) req.headers['x-company-id'] = companyId;
    if (tenantKey) req.headers['x-tenant-key'] = tenantKey;
    if (tenantStatus) req.headers['x-tenant-status'] = tenantStatus;
    req.headers['x-tenant-routing'] = routingMode;
    if (dbName) req.headers['x-tenant-db-name'] = dbName;

    // Never put connection URL on the inbound request object from clients;
    // services resolve via internal API when routingMode=tenant.
    (req as Request & { tenant?: JwtPayload }).tenant = payload;

    next();
  }
}
