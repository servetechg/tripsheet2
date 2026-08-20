import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { resolvePermissionGate } from './route-permissions';
import { auditRbacDeny } from './audit-deny';
import type { JwtPayload } from '../tenant/tenant-resolver.middleware';

@Injectable()
export class PermissionGateMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const path = (req.originalUrl || req.url || req.path || '')
      .split('?')[0]
      .replace(/\/+$/, '') || '/';
    const method = (req.method || 'GET').toUpperCase();
    const payload = (req as Request & { tenant?: JwtPayload }).tenant;

    if (!payload) {
      next();
      return;
    }

    const decision = resolvePermissionGate({
      method,
      path,
      role: payload.role || '',
      permissions: payload.permissions,
    });

    if (decision.allow) {
      next();
      return;
    }

    if (decision.auditDispatch) {
      const ip =
        String(req.headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim() ||
        req.socket.remoteAddress ||
        '';
      void auditRbacDeny(this.config, {
        companyId: payload.companyId || undefined,
        actorId: payload.sub,
        actorName: payload.email,
        permission: decision.permission,
        path,
        method,
        role: payload.role,
        ip,
        userAgent: String(req.headers['user-agent'] || ''),
      });
    }

    throw new ForbiddenException(decision.message);
  }
}
