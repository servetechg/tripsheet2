import { AsyncLocalStorage } from 'async_hooks';

export type TenantRoutingMode = 'shared' | 'tenant';

export interface TenantStore {
  userId?: string;
  role?: string;
  email?: string;
  permissions?: string[];
  driverId?: string;
  companyId?: string;
  tenantKey?: string;
  tenantStatus?: string;
  routingMode: TenantRoutingMode;
  connectionUrl?: string;
  dbName?: string;
  /** True when Prisma should use the tenant DB for this request */
  useTenantDb: boolean;
}

export const tenantAls = new AsyncLocalStorage<TenantStore>();

export function getTenantStore(): TenantStore | undefined {
  return tenantAls.getStore();
}

export function requireCompanyId(): string {
  const store = getTenantStore();
  if (store?.role === 'superadmin') {
    if (store.companyId) return store.companyId;
    throw new Error('SUPERADMIN_NEEDS_COMPANY');
  }
  if (!store?.companyId) {
    throw new Error('MISSING_COMPANY_CONTEXT');
  }
  return store.companyId;
}

export function isSuperAdmin(): boolean {
  return getTenantStore()?.role === 'superadmin';
}
