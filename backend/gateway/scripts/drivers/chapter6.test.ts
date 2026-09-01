/**
 * Chapter 6.19 driver management acceptance — live architecture tests (Phase 9).
 *
 * Proves through gateway:
 *   1. Driver APIs (dispatch-ready, border-eligible, performance)
 *   2. Invite revoke + regenerate
 *   3. Equipment assignment history (A closed, B active)
 *   4. Expired medical → dispatch-ready false
 *   5. HR approve pending_review → active when compliance docs present
 *
 * Prerequisites: gateway :3000 + auth, company, driver, fleet (optional asset fetch).
 *
 *   cd backend/gateway
 *   npm run test:drivers:live
 *
 * Options: --existing, --keep
 */
import { Harness, randTag, resolveCompanyOwner, sleep } from '../multi-tenant/harness';

type CompanyFix = {
  id: string;
  slug: string;
  email: string;
  password: string;
  token: string;
  ephemeral: boolean;
};

const args = new Set(process.argv.slice(2));
const USE_EXISTING = args.has('--existing');
const KEEP = args.has('--keep') || process.env.KEEP_FIXTURES === '1';

const SUPER_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@tripsheet.io';
const SUPER_PASS = process.env.SUPERADMIN_PASSWORD || 'admin123';

async function createEphemeral(
  h: Harness,
  superToken: string,
  tag: string,
  password: string,
): Promise<CompanyFix> {
  const shortName = `D${tag}`.slice(0, 6).toUpperCase();
  const slug = shortName.toLowerCase();
  const email = `owner-${slug}@driver-test.local`;

  const created = await h.post<{ id?: string }>(
    '/api/companies',
    {
      name: `Driver Test ${shortName}`,
      shortName,
      slug,
      planCode: 'professional',
      adminEmail: email,
      adminPassword: password,
      adminName: 'Driver Test Owner',
    },
    superToken,
  );
  h.okStatus(created.status, 'create company');
  const companyId = created.body?.id || '';
  await sleep(2500);
  const { token } = await h.login(email, password);
  return {
    id: companyId,
    slug,
    email,
    password,
    token,
    ephemeral: true,
  };
}

async function main() {
  const h = new Harness();
  console.log('TripSheet Driver Chapter 6.19 acceptance (Phase 9)');
  console.log(`Gateway  ${h.gateway}`);

  let superToken = '';
  let company: CompanyFix | null = null;
  const tag = randTag();
  const pw = `Drv${tag}9!Abcd`;

  try {
    h.suite('0. Health');
    await h.check('gateway /health', async () => {
      const r = await h.get('/health');
      h.okStatus(r.status, 'gateway');
    });
    h.endSuite();
    if (h.failed) throw new Error('gateway not reachable');

    h.suite('1. Company fixture');
    await h.check('superadmin login', async () => {
      const { token } = await h.login(SUPER_EMAIL, SUPER_PASS);
      superToken = token;
    });
    await h.check('bind company owner', async () => {
      company = USE_EXISTING
        ? await resolveCompanyOwner(h, superToken)
        : await createEphemeral(h, superToken, tag, pw);
      h.truthy(company.id, 'companyId');
      h.truthy(company.token, 'owner token');
    });
    h.endSuite();
    if (h.failed || !company) throw new Error('fixture failed');

    const co = () => company!;

    let driverId = '';
    let driverEmail = `drv-${tag}@driver-test.local`;

    h.suite('2. Driver record + chapter 6 endpoints');
    await h.check('create driver (active)', async () => {
      const r = await h.post<{ id?: string }>(
        '/api/drivers',
        {
          companyId: co().id,
          name: `Test Driver ${tag}`,
          email: driverEmail,
          lifecycleStatus: 'active',
          licenseNo: 'TEST-LIC-001',
        },
        co().token,
      );
      h.okStatus(r.status, 'create driver');
      driverId = r.body?.id || '';
      h.truthy(driverId, 'driver id');
    });
    await h.check('dispatch-ready responds', async () => {
      const r = await h.get<{
        ready?: boolean;
        missing?: string[];
        lifecycleOk?: boolean;
      }>(`/api/drivers/${driverId}/dispatch-ready`, co().token);
      h.okStatus(r.status, 'dispatch-ready');
      h.truthy(Array.isArray(r.body?.missing), 'missing array');
      h.eq(r.body?.lifecycleOk, true, 'lifecycleOk');
    });
    await h.check('border-eligible responds', async () => {
      const r = await h.get<{ eligible?: boolean; missing?: string[] }>(
        `/api/drivers/${driverId}/border-eligible`,
        co().token,
      );
      h.okStatus(r.status, 'border-eligible');
      h.truthy(typeof r.body?.eligible === 'boolean', 'eligible boolean');
    });
    await h.check('performance responds', async () => {
      const r = await h.get<{ totalLoads?: number }>(
        `/api/drivers/${driverId}/performance`,
        co().token,
      );
      h.okStatus(r.status, 'performance');
      h.truthy(typeof r.body?.totalLoads === 'number', 'totalLoads');
    });
    h.endSuite();

    h.suite('3. Invite revoke + regenerate');
    let inviteId = '';
    await h.check('create invite', async () => {
      const r = await h.post<{ id?: string; token?: string }>(
        '/api/invites',
        { companyId: co().id },
        co().token,
      );
      h.okStatus(r.status, 'invite');
      inviteId = r.body?.id || '';
      h.truthy(inviteId, 'invite id');
    });
    await h.check('revoke invite', async () => {
      const r = await h.post(`/api/invites/${inviteId}/revoke`, {}, co().token);
      h.okStatus(r.status, 'revoke');
    });
    await h.check('regenerate issues new pending invite', async () => {
      const r = await h.post<{ status?: string; token?: string }>(
        `/api/invites/${inviteId}/regenerate`,
        {},
        co().token,
      );
      h.okStatus(r.status, 'regenerate');
      h.truthy(r.body?.token, 'new token');
    });
    h.endSuite();

    h.suite('4. Equipment assignment history (#3)');
    const truckA = `asset-truck-a-${tag}`;
    const truckB = `asset-truck-b-${tag}`;
    await h.check('assign primary truck A', async () => {
      const r = await h.post(
        `/api/drivers/${driverId}/equipment-assignments`,
        {
          companyId: co().id,
          assetId: truckA,
          assetType: 'truck',
          role: 'primary',
          unitNo: '101',
        },
        co().token,
      );
      h.okStatus(r.status, 'assign A');
    });
    await h.check('assign primary truck B closes A', async () => {
      const r = await h.post(
        `/api/drivers/${driverId}/equipment-assignments`,
        {
          companyId: co().id,
          assetId: truckB,
          assetType: 'truck',
          role: 'primary',
          unitNo: '102',
        },
        co().token,
      );
      h.okStatus(r.status, 'assign B');
      const list = await h.get<
        Array<{ assetId: string; unassignedAt?: string | null }>
      >(`/api/drivers/${driverId}/equipment-assignments`, co().token);
      h.okStatus(list.status, 'list');
      const rows = list.body || [];
      h.truthy(rows.length >= 2, 'history length');
      const a = rows.find((x) => x.assetId === truckA);
      const b = rows.find((x) => x.assetId === truckB);
      h.truthy(a?.unassignedAt, 'truck A closed');
      h.eq(b?.unassignedAt ?? null, null, 'truck B active');
    });
    h.endSuite();

    h.suite('5. Expired medical blocks dispatch-ready (#2)');
    await h.check('seed expired medical qualification', async () => {
      const r = await h.post(
        `/api/drivers/${driverId}/qualifications`,
        {
          companyId: co().id,
          type: 'medical',
          expiryDate: '2000-01-01',
        },
        co().token,
      );
      h.okStatus(r.status, 'qualification');
    });
    await h.check('dispatch-ready false with medical missing/expired', async () => {
      const r = await h.get<{ ready?: boolean; missing?: string[] }>(
        `/api/drivers/${driverId}/dispatch-ready`,
        co().token,
      );
      h.okStatus(r.status, 'dispatch-ready');
      h.eq(r.body?.ready, false, 'not ready');
      h.truthy(r.body?.missing?.includes('medical'), 'medical in missing');
    });
    h.endSuite();

    h.suite('6. HR approve pending_review driver (#1)');
    let pendingDriverId = '';
    const pendingEmail = `pending-${tag}@driver-test.local`;
    await h.check('create driver pending_review', async () => {
      const r = await h.post<{ id?: string; lifecycleStatus?: string }>(
        '/api/drivers',
        {
          companyId: co().id,
          name: `Pending Driver ${tag}`,
          email: pendingEmail,
          lifecycleStatus: 'pending_review',
          licenseNo: 'PEND-LIC-001',
        },
        co().token,
      );
      h.okStatus(r.status, 'create pending driver');
      pendingDriverId = r.body?.id || '';
      h.truthy(pendingDriverId, 'pending driver id');
      h.eq(r.body?.lifecycleStatus, 'pending_review', 'lifecycle pending');
    });
    await h.check('seed compliance docs for approve', async () => {
      for (const spec of [
        { type: 'license', expiryDate: '2099-06-01' },
        { type: 'medical', expiryDate: '2099-06-01' },
        { type: 'abstract', expiryDate: '2099-06-01' },
      ] as const) {
        const r = await h.post(
          '/api/documents',
          {
            driverId: pendingDriverId,
            companyId: co().id,
            type: spec.type,
            fileName: `${spec.type}.pdf`,
            status: 'uploaded',
            expiryDate: spec.expiryDate,
          },
          co().token,
        );
        h.okStatus(r.status, `doc ${spec.type}`);
      }
      const docs = await h.get<Array<{ type: string }>>(
        `/api/documents?companyId=${encodeURIComponent(co().id)}&driverId=${encodeURIComponent(pendingDriverId)}`,
        co().token,
      );
      h.okStatus(docs.status, 'list docs');
      const rows = docs.body || [];
      for (const spec of ['license', 'medical', 'abstract'] as const) {
        h.truthy(
          rows.some(
            (d) => d.type === spec && d.driverId === pendingDriverId,
          ),
          `${spec} doc stored for pending driver`,
        );
      }
    });
    await h.check('compliance clear before approve', async () => {
      const r = await h.get<{ missing?: string[] }>(
        `/api/drivers/${pendingDriverId}/dispatch-ready`,
        co().token,
      );
      h.okStatus(r.status, 'dispatch-ready pre-approve');
      h.eq(
        r.body?.missing?.length ?? -1,
        0,
        `compliance blockers: ${JSON.stringify(r.body?.missing)}`,
      );
    });
    await h.check('approve activates driver', async () => {
      const r = await h.post<{ lifecycleStatus?: string; active?: boolean }>(
        `/api/drivers/${pendingDriverId}/approve`,
        {},
        co().token,
      );
      h.okStatus(r.status, 'approve');
      h.eq(r.body?.lifecycleStatus, 'active', 'lifecycle active');
    });
    await h.check('dispatch-ready true after approve', async () => {
      const r = await h.get<{ ready?: boolean; lifecycleOk?: boolean }>(
        `/api/drivers/${pendingDriverId}/dispatch-ready`,
        co().token,
      );
      h.okStatus(r.status, 'dispatch-ready');
      h.eq(r.body?.lifecycleOk, true, 'lifecycleOk');
      h.eq(r.body?.ready, true, 'ready');
    });
    h.endSuite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    h.failed += 1;
    h.failures.push(`fatal: ${msg}`);
    console.error('\nFatal:', msg);
  } finally {
    if (!USE_EXISTING && !KEEP && superToken && company?.ephemeral) {
      console.log('\n▸ cleanup ephemeral tenant');
      try {
        await h.post(
          `/api/tenants/${company.id}/deprovision?dropDatabase=true`,
          {},
          superToken,
        );
      } catch {
        /* ignore */
      }
    }
    h.printSummary();
  }

  process.exit(h.failed ? 1 : 0);
}

void main();
