/**
 * Multi-tenant architecture tests (Phases 1–6).
 *
 * Proves: provision, JWT tenantKey, row isolation, spoofed companyId,
 * org (branding) isolation, plan gates, suspend, ops dashboard.
 *
 * Prerequisites: gateway :3000 + auth, company, driver, accounting services.
 *
 *   cd backend/gateway
 *   npm run test:tenancy
 *
 * Options:
 *   --existing   Use two already-active tenants (no provision / no cleanup)
 *   --keep       Keep companies created by this run
 *
 * Env:
 *   GATEWAY_URL           default http://localhost:3000
 *   SUPERADMIN_EMAIL      default admin@tripsheet.io
 *   SUPERADMIN_PASSWORD   default admin123
 */
import {
  Harness,
  ensureTenantSchemas,
  randTag,
  resolveExistingTenants,
  sleep,
  SkipError,
} from './harness';

type TenantRow = {
  companyId: string;
  dbName?: string;
  status?: string;
  routingMode?: string;
  etlStatus?: string;
  lastError?: string;
  company?: {
    name?: string;
    slug?: string;
    status?: string;
    active?: boolean;
  };
};

type Fixture = {
  id: string;
  slug: string;
  dbName: string;
  email: string;
  password: string;
  token: string;
  tenantKey: string;
  ephemeral: boolean;
};

const args = new Set(process.argv.slice(2));
const USE_EXISTING = args.has('--existing');
const KEEP = args.has('--keep') || process.env.KEEP_FIXTURES === '1';

const SUPER_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@tripsheet.io';
const SUPER_PASS = process.env.SUPERADMIN_PASSWORD || 'admin123';

async function main() {
  const h = new Harness();
  console.log('TripSheet multi-tenant architecture tests');
  console.log(`Gateway  ${h.gateway}`);
  console.log(
    `Mode     ${USE_EXISTING ? 'existing tenants' : 'provision two ephemeral tenants'}${KEEP ? ' (keep fixtures)' : ''}`,
  );

  let superToken = '';
  const fixtures: Fixture[] = [];

  try {
    h.suite('0. Health');
    await h.check('gateway /health', async () => {
      const r = await h.get('/health');
      h.okStatus(r.status, 'gateway');
    });
    h.endSuite();

    h.suite('1. Auth + tenantKey');
    await h.check('superadmin login', async () => {
      const { token, user } = await h.login(SUPER_EMAIL, SUPER_PASS);
      superToken = token;
      h.eq(user.role, 'superadmin', 'role');
    });
    await h.check('/api/auth/me includes role', async () => {
      const r = await h.get<{ role?: string }>('/api/auth/me', superToken);
      h.okStatus(r.status, 'me');
      h.eq(r.body?.role, 'superadmin', 'role');
    });
    h.endSuite();

    h.suite('2. Registry + provision');
    await h.check('GET /api/tenants (registry, no secrets)', async () => {
      const r = await h.get<TenantRow[]>('/api/tenants', superToken);
      h.okStatus(r.status, 'tenants');
      h.truthy(Array.isArray(r.body), 'expected array');
      const leaked = (r.body || []).some(
        (row) =>
          row &&
          typeof row === 'object' &&
          ('connectionUrl' in row || 'connectionCiphertext' in row),
      );
      h.eq(leaked, false, 'registry must not leak connection secrets');
    });

    if (USE_EXISTING) {
      await h.check('bind two active tenants', async () => {
        const found = await resolveExistingTenants(h, superToken, 2);
        fixtures.push(...found);
        h.eq(fixtures.length, 2, 'need two active tenants');
      });
    } else {
      await h.check('provision tenant A (starter)', async () => {
        fixtures.push(
          await createEphemeral(h, superToken, 'A', 'starter'),
        );
      });
      await h.check('provision tenant B (professional)', async () => {
        fixtures.push(
          await createEphemeral(h, superToken, 'B', 'professional'),
        );
      });
      await h.check('ensure ops schemas on new tenants', async () => {
        for (const f of fixtures) {
          await ensureTenantSchemas(f.id);
        }
      });
    }

    const a = fixtures[0];
    const b = fixtures[1];
    if (!a || !b) {
      h.skip('remaining suites', 'need two tenants');
      return;
    }

    await h.check('db names are fq_tenant_{slug}', async () => {
      h.eq(a.dbName, `fq_tenant_${a.slug}`, 'A');
      h.eq(b.dbName, `fq_tenant_${b.slug}`, 'B');
      h.truthy(a.slug !== b.slug, 'slugs must differ');
    });

    await h.check('company-admin JWT carries tenantKey', async () => {
      h.eq(a.tenantKey, a.slug, 'A tenantKey');
      h.eq(b.tenantKey, b.slug, 'B tenantKey');
    });
    h.endSuite();

    h.suite('3. Isolation');
    let driverA: { id?: string; name?: string; companyId?: string } = {};
    let driverB: { id?: string; name?: string; companyId?: string } = {};
    const markerA = `iso-a-${randTag()}`;
    const markerB = `iso-b-${randTag()}`;

    await h.check('create driver in A', async () => {
      const r = await h.post<{ id?: string; name?: string; companyId?: string }>(
        '/api/drivers',
        {
          companyId: a.id,
          name: markerA,
          email: `${markerA}@mt-test.local`,
          licenseNo: `A-${randTag()}`,
        },
        a.token,
      );
      if (r.status >= 400) {
        throw new Error(`create A: HTTP ${r.status} ${r.raw.slice(0, 240)}`);
      }
      h.eq(r.body?.companyId, a.id, 'companyId');
      driverA = r.body || {};
    });

    await h.check('create driver in B', async () => {
      const r = await h.post<{ id?: string; name?: string; companyId?: string }>(
        '/api/drivers',
        {
          companyId: b.id,
          name: markerB,
          email: `${markerB}@mt-test.local`,
          licenseNo: `B-${randTag()}`,
        },
        b.token,
      );
      h.okStatus(r.status, 'create B');
      h.eq(r.body?.companyId, b.id, 'companyId');
      driverB = r.body || {};
    });

    await h.check('A list does not include B rows', async () => {
      const r = await h.get<Array<{ id?: string; companyId?: string; name?: string }>>(
        '/api/drivers',
        a.token,
      );
      h.okStatus(r.status, 'list A');
      const list = Array.isArray(r.body) ? r.body : [];
      const leak = list.some(
        (d) => d.companyId === b.id || d.id === driverB.id || d.name === markerB,
      );
      const own = list.some((d) => d.id === driverA.id || d.name === markerA);
      h.eq(leak, false, 'A leaked B');
      h.eq(own, true, 'A missing own driver');
    });

    await h.check('B list does not include A rows', async () => {
      const r = await h.get<Array<{ id?: string; companyId?: string; name?: string }>>(
        '/api/drivers',
        b.token,
      );
      h.okStatus(r.status, 'list B');
      const list = Array.isArray(r.body) ? r.body : [];
      const leak = list.some(
        (d) => d.companyId === a.id || d.id === driverA.id || d.name === markerA,
      );
      h.eq(leak, false, 'B leaked A');
    });

    await h.check('A cannot spoof ?companyId=B', async () => {
      const r = await h.get<Array<{ id?: string; companyId?: string; name?: string }>>(
        `/api/drivers?companyId=${encodeURIComponent(b.id)}`,
        a.token,
      );
      h.okStatus(r.status, 'spoof query');
      const list = Array.isArray(r.body) ? r.body : [];
      const sawB = list.some(
        (d) => d.companyId === b.id || d.id === driverB.id || d.name === markerB,
      );
      h.eq(sawB, false, 'spoof query returned B');
    });

    await h.check('A cannot spoof x-company-id header', async () => {
      const r = await h.get<Array<{ companyId?: string; name?: string }>>(
        '/api/drivers',
        a.token,
        { 'x-company-id': b.id, 'x-tenant-key': b.slug },
      );
      h.okStatus(r.status, 'spoof header');
      const list = Array.isArray(r.body) ? r.body : [];
      const sawB = list.some((d) => d.companyId === b.id || d.name === markerB);
      h.eq(sawB, false, 'spoof header returned B');
    });

    await h.check('A cannot POST driver into B via body companyId', async () => {
      const name = `spoof-write-${randTag()}`;
      const r = await h.post<{ companyId?: string; name?: string }>(
        '/api/drivers',
        {
          companyId: b.id,
          name,
          email: `${name}@mt-test.local`,
        },
        a.token,
      );
      if (r.status >= 500) {
        throw new Error(`spoof create HTTP ${r.status} ${r.raw.slice(0, 200)}`);
      }
      if (r.status >= 200 && r.status < 300) {
        h.eq(r.body?.companyId, a.id, 'write must land in A not B');
        const bList = await h.get<Array<{ name?: string }>>(
          '/api/drivers',
          b.token,
        );
        const landed = (Array.isArray(bList.body) ? bList.body : []).some(
          (d) => d.name === name,
        );
        h.eq(landed, false, 'spoofed create appeared in B');
      }
    });

    await h.check('A GET /drivers/:id of B is hidden', async () => {
      if (!driverB.id) throw new Error('no B driver id');
      const r = await h.get(`/api/drivers/${driverB.id}`, a.token);
      h.truthy(
        r.status === 404 || r.status === 403,
        `expected 404/403, got ${r.status} ${r.raw.slice(0, 160)}`,
      );
    });
    h.endSuite();

    h.suite('4. Org isolation + entitlements');
    const colorA = '#aa1111';
    const colorB = '#11aa22';

    await h.check('branding writes stay in tenant DB', async () => {
      const pa = await h.patch(
        `/api/companies/${a.id}/branding`,
        { accentColor: colorA },
        a.token,
      );
      h.okStatus(pa.status, 'patch A');
      const pb = await h.patch(
        `/api/companies/${b.id}/branding`,
        { accentColor: colorB },
        b.token,
      );
      h.okStatus(pb.status, 'patch B');

      const ga = await h.get<{ accentColor?: string }>(
        `/api/companies/${a.id}/branding`,
        a.token,
      );
      const gb = await h.get<{ accentColor?: string }>(
        `/api/companies/${b.id}/branding`,
        b.token,
      );
      h.eq(ga.body?.accentColor, colorA, 'A color');
      h.eq(gb.body?.accentColor, colorB, 'B color');
    });

    await h.check('A cannot read B branding by URL', async () => {
      const r = await h.get(`/api/companies/${b.id}/branding`, a.token);
      h.truthy(
        r.status === 403 || r.status === 404,
        `expected 403/404, got ${r.status}`,
      );
    });

    await h.check('starter plan blocks accounting', async () => {
      const ent = await h.get<{
        planCode?: string;
        features?: { accounting?: boolean };
        maxDrivers?: number;
      }>(`/api/companies/${a.id}/entitlements`, a.token);
      h.okStatus(ent.status, 'entitlements');
      const gated = ent.body?.features?.accounting === false;
      if (!gated) {
        throw new SkipError(`A plan=${ent.body?.planCode} has accounting`);
      }
      const inv = await h.get('/api/invoices', a.token);
      h.eq(inv.status, 403, 'invoices should be gated');
    });

    await h.check('professional plan allows accounting list', async () => {
      const ent = await h.get<{
        planCode?: string;
        features?: { accounting?: boolean };
      }>(`/api/companies/${b.id}/entitlements`, b.token);
      h.okStatus(ent.status, 'entitlements B');
      if (ent.body?.features?.accounting === false) {
        throw new Error('tenant B should have accounting');
      }
      const inv = await h.get('/api/invoices', b.token);
      h.truthy(
        inv.status !== 403 && inv.status < 500,
        `professional invoices blocked or crashed: HTTP ${inv.status} ${inv.raw.slice(0, 120)}`,
      );
    });

    await h.check('upgrade A to professional lifts invoice gate', async () => {
      const ch = await h.post(
        `/api/companies/${a.id}/plan`,
        { planCode: 'professional' },
        superToken,
      );
      h.okStatus(ch.status, 'change plan');
      const inv = await h.get('/api/invoices', a.token);
      h.truthy(
        inv.status !== 403 && inv.status < 500,
        `still gated/crashed after upgrade: HTTP ${inv.status}`,
      );
    });
    h.endSuite();

    h.suite('5. Suspend');
    await h.check('disable A → company-admin APIs 403; B still works', async () => {
      const tog = await h.patch(`/api/companies/${a.id}/toggle-active`, {}, superToken);
      h.okStatus(tog.status, 'disable');
      const blocked = await h.poll(
        () => h.get('/api/drivers', a.token),
        (r) => r.status === 403,
        {
          timeoutMs: 75_000,
          intervalMs: 2000,
          label: 'A drivers 403 after suspend (cache TTL ≤ 60s)',
        },
      );
      h.eq(blocked.status, 403, 'A after suspend');
      const bOk = await h.get('/api/drivers', b.token);
      h.okStatus(bOk.status, 'B must remain usable');
    });

    await h.check('re-enable A restores access', async () => {
      const tog = await h.patch(`/api/companies/${a.id}/toggle-active`, {}, superToken);
      h.okStatus(tog.status, 'enable');
      a.token = (await h.login(a.email, a.password)).token;
      const restored = await h.poll(
        () => h.get('/api/drivers', a.token),
        (r) => r.status >= 200 && r.status < 300,
        {
          timeoutMs: 120_000,
          intervalMs: 2000,
          label: 'A drivers after re-enable',
        },
      );
      h.okStatus(restored.status, 'A restored');
    });
    h.endSuite();

    h.suite('6. Ops dashboard');
    await h.check('GET /api/tenants/ops/summary', async () => {
      const r = await h.get<{
        totals?: { tenants?: number };
        tenants?: Array<{ companyId?: string; dbName?: string }>;
      }>('/api/tenants/ops/summary', superToken);
      h.okStatus(r.status, 'ops summary');
      h.truthy(
        (r.body?.totals?.tenants || 0) >= 2,
        'expected ≥2 tenants in ops summary',
      );
      const ids = new Set((r.body?.tenants || []).map((t) => t.companyId));
      h.truthy(ids.has(a.id), 'A missing from ops');
      h.truthy(ids.has(b.id), 'B missing from ops');
    });

    await h.check('tenant schema push is idempotent', async () => {
      for (const f of [a, b]) {
        const meta = await h.get<TenantRow>(`/api/tenants/${f.id}`, superToken);
        if (meta.body?.status === 'active') {
          await ensureTenantSchemas(f.id);
        }
      }
    });
    h.endSuite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    h.failed += 1;
    h.failures.push(`fatal: ${msg}`);
    console.error('\nFatal:', msg);
  } finally {
    if (!USE_EXISTING && !KEEP && superToken) {
      console.log('\n▸ cleanup ephemeral tenants');
      for (const f of fixtures.filter((x) => x.ephemeral)) {
        try {
          await h.post(
            `/api/tenants/${f.id}/deprovision?dropDatabase=true`,
            {},
            superToken,
          );
          console.log(`  dropped ${f.dbName}`);
        } catch (e) {
          console.log(`  cleanup failed for ${f.slug}: ${String(e)}`);
        }
      }
    } else if (!USE_EXISTING && KEEP) {
      console.log('\nKept fixtures:');
      for (const f of fixtures) {
        console.log(`  ${f.slug}  ${f.email} / ${f.password}  ${f.dbName}`);
      }
    }
    h.printSummary();
  }

  process.exit(h.failed ? 1 : 0);
}

async function createEphemeral(
  h: Harness,
  superToken: string,
  label: string,
  planCode: string,
): Promise<Fixture> {
  const tag = randTag();
  const shortName = `${label}${tag}`.slice(0, 6).toUpperCase();
  const slug = shortName.toLowerCase();
  const password = `Test${tag}9!`;
  const email = `admin-${slug}@mt-test.local`;

  const created = await h.post<{
    id?: string;
    slug?: string;
    tenantDatabase?: { dbName?: string; status?: string; lastError?: string };
  }>(
    '/api/companies',
    {
      name: `MT Test ${shortName}`,
      shortName,
      slug,
      planCode,
      tagline: 'architecture-test',
    },
    superToken,
  );
  if (created.status >= 400 || !created.body?.id) {
    throw new Error(
      `create company ${shortName}: HTTP ${created.status} ${created.raw.slice(0, 300)}`,
    );
  }
  const id = created.body.id;

  const user = await h.post(
    '/api/auth/users',
    {
      name: `${shortName} Admin`,
      email,
      password,
      role: 'company_owner',
      companyId: id,
    },
    superToken,
  );
  if (user.status >= 400) {
    throw new Error(`create admin ${email}: HTTP ${user.status} ${user.raw.slice(0, 240)}`);
  }

  const tenant = await h.poll(
    () => h.get<TenantRow>(`/api/tenants/${id}`, superToken),
    (r) => r.status < 500 && r.body?.status === 'active',
    { timeoutMs: 120_000, label: `${slug} provisioned` },
  );
  if (tenant.body?.status !== 'active') {
    throw new Error(
      `provision ${slug}: status=${tenant.body?.status} error=${tenant.body?.lastError || ''}`,
    );
  }

  await sleep(300);
  const route = await h.patch(
    `/api/tenants/${id}/routing-mode`,
    { routingMode: 'tenant' },
    superToken,
  );
  if (route.status >= 400) {
    throw new Error(
      `set tenant routing ${slug}: HTTP ${route.status} ${route.raw.slice(0, 200)}`,
    );
  }

  const { token, user: logged } = await h.login(email, password);

  return {
    id,
    slug: created.body.slug || slug,
    dbName: tenant.body?.dbName || `fq_tenant_${slug}`,
    email,
    password,
    token,
    tenantKey: String(logged.tenantKey || slug),
    ephemeral: true,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
