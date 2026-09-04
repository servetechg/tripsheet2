import { PrismaClient } from '@prisma/client';
import { getTenantStore } from './context';

export function withSchema(connectionUrl: string, schema: string): string {
  const u = new URL(connectionUrl);
  u.searchParams.set('schema', schema);
  return u.toString();
}

/**
 * Builds a Proxy around a Nest PrismaService so model access
 * (`prisma.driver.findMany`) hits the tenant or shared client.
 */
export function createTenantPrismaProxy<T extends object>(
  host: T,
  opts: {
    schema: string;
    shared: PrismaClient;
    pools: Map<string, PrismaClient>;
    createClient: (url: string) => PrismaClient;
    maxPools?: number;
  },
): T {
  const maxPools = opts.maxPools ?? 50;

  const current = (): PrismaClient => {
    const store = getTenantStore();
    if (!store?.useTenantDb || !store.connectionUrl) {
      return opts.shared;
    }
    const key = `${store.dbName || store.companyId || 'x'}:${opts.schema}`;
    let client = opts.pools.get(key);
    if (!client) {
      if (opts.pools.size >= maxPools) {
        const oldest = opts.pools.keys().next().value;
        if (oldest) {
          const old = opts.pools.get(oldest);
          opts.pools.delete(oldest);
          void old?.$disconnect();
        }
      }
      const url = withSchema(store.connectionUrl, opts.schema);
      client = opts.createClient(url);
      opts.pools.set(key, client);
    }
    return client;
  };

  return new Proxy(host, {
    get(target, prop, receiver) {
      if (
        prop === 'onModuleInit' ||
        prop === 'onModuleDestroy' ||
        prop === '$connect' ||
        prop === '$disconnect' ||
        prop === 'currentClient' ||
        prop === 'then' ||
        prop === 'constructor'
      ) {
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      }

      // Prefer host methods/props when defined (lifecycle, helpers)
      if (prop in (target as object) && typeof prop === 'string') {
        const own = Reflect.get(target, prop, receiver);
        if (
          own !== undefined &&
          (typeof own === 'function' ||
            prop.startsWith('_') ||
            prop === 'shared' ||
            prop === 'pools')
        ) {
          return typeof own === 'function' ? own.bind(target) : own;
        }
      }

      const client = current();
      const value = Reflect.get(client as object, prop);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }) as T;
}

export async function attachCompanyGuard(client: PrismaClient) {
  // Prisma $use removed in v5+; use client extension pattern when needed.
  // Defense-in-depth for findUnique is handled in TenantScopeInterceptor + services.
  void client;
}
