import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getTenantStore, isSuperAdmin } from './context';

/**
 * Forces companyId on query/body from JWT context for non-superadmin.
 * Filters array responses that include companyId.
 */
@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const store = getTenantStore();
    const role = store?.role || req.headers['x-user-role'];
    const companyId = store?.companyId || req.headers['x-company-id'];

    if (role && role !== 'superadmin') {
      if (!companyId) {
        throw new ForbiddenException('Company context required');
      }
      if (req.query && typeof req.query === 'object') {
        req.query.companyId = companyId;
      }
      if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        if (
          'companyId' in req.body ||
          req.method === 'POST' ||
          req.method === 'PUT' ||
          req.method === 'PATCH'
        ) {
          // Overwrite spoofed companyId on mutating / company-bearing bodies
          if (
            'companyId' in req.body ||
            req.path?.includes('drivers') ||
            req.path?.includes('assets') ||
            req.path?.includes('loads') ||
            req.path?.includes('invites') ||
            req.path?.includes('documents') ||
            req.path?.includes('contracts') ||
            req.path?.includes('trip-sheets') ||
            req.path?.includes('settlements') ||
            req.path?.includes('invoices') ||
            req.path?.includes('notifications') ||
            req.path?.includes('messages')
          ) {
            (req.body as { companyId?: string }).companyId = String(companyId);
          }
        }
      }
    }

    return next.handle().pipe(
      map((data) => {
        if (isSuperAdmin() || !companyId) return data;
        return filterByCompany(data, String(companyId));
      }),
    );
  }
}

function filterByCompany(data: unknown, companyId: string): unknown {
  if (Array.isArray(data)) {
    return data.filter((row) => {
      if (!row || typeof row !== 'object') return true;
      if (!('companyId' in row)) return true;
      return (row as { companyId?: string }).companyId === companyId;
    });
  }
  if (data && typeof data === 'object' && 'companyId' in data) {
    if ((data as { companyId?: string }).companyId !== companyId) {
      throw new NotFoundException('Resource not found');
    }
  }
  return data;
}
