/**
 * Chapter 5.21 MDM acceptance — live gateway tests (Phase 8).
 *
 * Proves through gateway:
 *   1. Broker saved → selectable in dispatch/accounting pickers
 *   2. OOS truck blocks load assignment
 *   3. Port of entry catalog available for cross-border
 *   4. Active driver + MDM broker → load created (drivers × MDM)
 *
 * Prerequisites: gateway :3000 + auth, company, driver, fleet.
 *
 *   cd backend/gateway
 *   npm run test:mdm:live
 *
 * Options: --existing
 */
import {
  Harness,
  randTag,
  resolveCompanyOwner,
  seedActiveDriverWithCompliance,
} from '../multi-tenant/harness';

type CompanyFix = {
  id: string;
  slug: string;
  email: string;
  password: string;
  token: string;
  ephemeral: false;
};

const args = new Set(process.argv.slice(2));
const USE_EXISTING = args.has('--existing');

const SUPER_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@tripsheet.io';
const SUPER_PASS = process.env.SUPERADMIN_PASSWORD || 'admin123';

async function main() {
  const h = new Harness();
  console.log('TripSheet MDM Chapter 5.21 acceptance (live)');
  console.log(`Gateway  ${h.gateway}`);

  let superToken = '';
  let company: CompanyFix | null = null;
  const tag = randTag();

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
      if (!USE_EXISTING) {
        throw new Error('use --existing (MKX seed) for MDM live tests');
      }
      company = await resolveCompanyOwner(h, superToken);
      h.truthy(company.id, 'companyId');
      h.truthy(company.token, 'owner token');
    });
    h.endSuite();
    if (h.failed || !company) throw new Error('fixture failed');

    const co = () => company!;

    h.suite('2. Broker picker (#1)');
    let brokerId = '';
    let blockedBrokerId = '';
    await h.check('create active broker', async () => {
      const r = await h.post<{ id?: string; name?: string }>(
        `/api/companies/${co().id}/brokers`,
        { name: `MDM Broker ${tag}`, status: 'active' },
        co().token,
      );
      h.okStatus(r.status, 'create broker');
      brokerId = r.body?.id || '';
      h.truthy(brokerId, 'broker id');
    });
    await h.check('selectableOnly includes active broker', async () => {
      const r = await h.get<Array<{ id: string; status: string }>>(
        `/api/companies/${co().id}/brokers?selectableOnly=1`,
        co().token,
      );
      h.okStatus(r.status, 'list brokers');
      const ids = (r.body || []).map((b) => b.id);
      h.truthy(ids.includes(brokerId), 'active broker in picker');
    });
    await h.check('blacklisted broker hidden from picker', async () => {
      const created = await h.post<{ id?: string }>(
        `/api/companies/${co().id}/brokers`,
        { name: `Blocked Broker ${tag}`, status: 'blacklisted' },
        co().token,
      );
      h.okStatus(created.status, 'create blacklisted');
      blockedBrokerId = created.body?.id || '';
      const r = await h.get<Array<{ id: string }>>(
        `/api/companies/${co().id}/brokers?selectableOnly=1`,
        co().token,
      );
      h.okStatus(r.status, 'list selectable');
      const ids = (r.body || []).map((b) => b.id);
      h.eq(ids.includes(blockedBrokerId), false, 'blacklisted omitted');
    });
    h.endSuite();

    h.suite('3. Ports of entry (#3)');
    await h.check('ports catalog seeded', async () => {
      const r = await h.get<Array<{ code?: string; country?: string }>>(
        `/api/companies/${co().id}/ports-of-entry`,
        co().token,
      );
      h.okStatus(r.status, 'ports');
      h.truthy(Array.isArray(r.body) && r.body.length > 0, 'ports non-empty');
      h.truthy(
        (r.body || []).some((p) => p.country === 'US' || p.code?.startsWith('3')),
        'US port present',
      );
    });
    h.endSuite();

    h.suite('4. OOS asset blocks load (#2)');
    let oosTruckId = '';
    let driverId = '';
    await h.check('seed dispatch-ready driver', async () => {
      driverId = await seedActiveDriverWithCompliance(
        h,
        co().token,
        co().id,
        tag,
      );
      h.truthy(driverId, 'driver id');
    });
    await h.check('create OOS truck', async () => {
      const r = await h.post<{ id?: string }>(
        '/api/assets',
        {
          companyId: co().id,
          type: 'truck',
          unitNo: `OOS-${tag}`,
          status: 'out_of_service',
        },
        co().token,
      );
      h.okStatus(r.status, 'create truck');
      oosTruckId = r.body?.id || '';
      h.truthy(oosTruckId, 'truck id');
    });
    await h.check('load with OOS truck rejected', async () => {
      const r = await h.post(
        '/api/loads',
        {
          companyId: co().id,
          driverId,
          truckId: oosTruckId,
          origin: 'Calgary, AB',
          destination: 'Edmonton, AB',
          brokerId,
          brokerName: `MDM Broker ${tag}`,
        },
        co().token,
      );
      h.eq(r.status >= 400, true, 'OOS assign blocked');
      h.truthy(
        String(r.raw).toLowerCase().includes('out of service') ||
          String(r.raw).toLowerCase().includes('cannot be assigned'),
        'OOS reason in response',
      );
    });
    h.endSuite();

    h.suite('5. Driver + broker dispatch (drivers × MDM)');
    let goodTruckId = '';
    await h.check('create available truck', async () => {
      const r = await h.post<{ id?: string }>(
        '/api/assets',
        {
          companyId: co().id,
          type: 'truck',
          unitNo: `OK-${tag}`,
          status: 'available',
        },
        co().token,
      );
      h.okStatus(r.status, 'create truck');
      goodTruckId = r.body?.id || '';
      h.truthy(goodTruckId, 'truck id');
    });
    await h.check('load with driver + broker + truck succeeds', async () => {
      const r = await h.post<{ id?: string; brokerId?: string; driverId?: string }>(
        '/api/loads',
        {
          companyId: co().id,
          driverId,
          truckId: goodTruckId,
          origin: 'Calgary, AB',
          destination: 'Regina, SK',
          brokerId,
          brokerName: `MDM Broker ${tag}`,
          tripNo: `MDM-${tag}`,
        },
        co().token,
      );
      h.okStatus(r.status, 'create load');
      h.eq(r.body?.brokerId, brokerId, 'broker id on load');
      h.eq(r.body?.driverId, driverId, 'driver id on load');
    });
    h.endSuite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    h.failed += 1;
    h.failures.push(`fatal: ${msg}`);
    console.error('\nFatal:', msg);
  } finally {
    h.printSummary();
  }

  process.exit(h.failed ? 1 : 0);
}

void main();
