import { ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assertPermission,
  actorHasPermission,
  getTenantStore,
} from '@tripsheet/tenant-runtime';

const log = new Logger('Rbac');

export function requirePerm(code: string) {
  assertPermission(code);
}

export async function requireDispatchWrite(
  config: ConfigService,
  code: string,
  extra?: { path?: string; method?: string },
) {
  if (actorHasPermission(code)) return;
  const store = getTenantStore();
  const base =
    config.get<string>('COMPANY_SERVICE_URL') || 'http://localhost:3002';
  try {
    await fetch(`${base.replace(/\/$/, '')}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: store?.companyId || null,
        actorId: store?.userId || null,
        actorName: store?.email || '',
        action: 'rbac.deny',
        entityType: 'dispatch',
        entityId: extra?.path || 'loads',
        meta: {
          permission: code,
          method: extra?.method,
          role: store?.role,
        },
      }),
    });
  } catch (e) {
    log.warn(`rbac.deny audit failed: ${String(e)}`);
  }
  throw new ForbiddenException(`Missing permission: ${code}`);
}

export function driverScopeId(): string | undefined {
  const store = getTenantStore();
  if (store?.role === 'driver') return store.driverId || '__none__';
  return undefined;
}
