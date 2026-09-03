/**
 * Load test: simulate N concurrent tenants hitting the gateway.
 *
 *   cd backend/gateway && npm run test:load
 *   TENANT_N=10 CONCURRENCY=20 REQUESTS=200 npm run test:load
 */
import * as jwt from 'jsonwebtoken';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const COMPANY_URL = process.env.COMPANY_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TENANT_N = Number(process.env.TENANT_N || 5);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const REQUESTS = Number(process.env.REQUESTS || 100);
const PATH = process.env.LOAD_PATH || '/api/drivers';

type Tenant = { companyId: string; tenantKey: string };

function token(t: Tenant, i: number) {
  return jwt.sign(
    {
      sub: `load-user-${t.tenantKey}-${i}`,
      role: 'company_owner',
      companyId: t.companyId,
      tenantKey: t.tenantKey,
      email: `load-${t.tenantKey}@test.local`,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function discoverTenants(): Promise<Tenant[]> {
  if (process.env.COMPANY_IDS && process.env.TENANT_KEYS) {
    const ids = process.env.COMPANY_IDS.split(',').map((s) => s.trim());
    const keys = process.env.TENANT_KEYS.split(',').map((s) => s.trim());
    return ids.map((companyId, i) => ({
      companyId,
      tenantKey: keys[i] || `t${i}`,
    }));
  }
  try {
    const res = await fetch(`${COMPANY_URL}/tenants`);
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as Array<{
      companyId: string;
      status: string;
      company?: { slug?: string };
    }>;
    return rows
      .filter((r) => r.status === 'active' && r.company?.slug)
      .slice(0, TENANT_N)
      .map((r) => ({
        companyId: r.companyId,
        tenantKey: r.company!.slug!,
      }));
  } catch {
    return Array.from({ length: TENANT_N }, (_, i) => ({
      companyId: `sim-company-${i}`,
      tenantKey: `sim${i}`,
    }));
  }
}

async function oneRequest(t: Tenant, i: number) {
  const started = Date.now();
  const res = await fetch(`${GATEWAY}${PATH}`, {
    headers: { Authorization: `Bearer ${token(t, i)}` },
  });
  const ms = Date.now() - started;
  return { status: res.status, ms, tenantKey: t.tenantKey };
}

async function pool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<unknown>,
) {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const tenants = await discoverTenants();
  if (!tenants.length) {
    console.error('No tenants to load-test');
    process.exit(1);
  }

  const jobs = Array.from({ length: REQUESTS }, (_, i) => tenants[i % tenants.length]);
  const results: { status: number; ms: number; tenantKey: string }[] = [];

  const t0 = Date.now();
  await pool(jobs, CONCURRENCY, async (t, i) => {
    try {
      results.push(await oneRequest(t, i));
    } catch (e) {
      results.push({
        status: 0,
        ms: 0,
        tenantKey: t.tenantKey,
      });
      console.warn('request failed', e);
    }
  });
  const elapsed = Date.now() - t0;

  const ok = results.filter((r) => r.status > 0 && r.status < 500).length;
  const err5xx = results.filter((r) => r.status >= 500).length;
  const networkFail = results.filter((r) => r.status === 0).length;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  const byTenant: Record<string, number> = {};
  for (const r of results) {
    byTenant[r.tenantKey] = (byTenant[r.tenantKey] || 0) + 1;
  }

  const report = {
    tenants: tenants.length,
    requests: REQUESTS,
    concurrency: CONCURRENCY,
    path: PATH,
    elapsedMs: elapsed,
    rps: Number((REQUESTS / (elapsed / 1000)).toFixed(1)),
    ok,
    err5xx,
    networkFail,
    p50Ms: p50,
    p95Ms: p95,
    byTenant,
  };

  console.log(JSON.stringify(report, null, 2));
  if (err5xx > REQUESTS * 0.05 || networkFail > REQUESTS * 0.1) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
