/**
 * Chapter 2 RBAC persona architecture tests (Phase 5).
 *
 * Proves 2.10: owner creates a dispatcher with that role only;
 * accountant cannot edit dispatch (403 + rbac.deny audit);
 * driver sees only own loads.
 *
 * Prerequisites: gateway :3000 + auth, company, driver, fleet services.
 *
 *   cd backend/gateway
 *   npm run test:rbac:live
 *
 * Options:
 *   --existing   Use one already-active tenant (needs owner login)
 *   --keep       Keep the company created by this run
 *
 * Env:
 *   GATEWAY_URL, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *   --existing: RBAC_OWNER_EMAIL / RBAC_OWNER_PASSWORD
 *     or ADMIN_<SLUG>_EMAIL / _PASSWORD (mkx defaults to admin@mkx.ca / mkx123)
 */
import { Harness, randTag, resolveCompanyOwner, sleep } from '../multi-tenant/harness';

type TenantRow = {
  companyId: string;
  dbName?: string;
  status?: string;
  lastError?: string;
  company?: { name?: string; slug?: string; status?: string };
};

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

function perms(user: { permissions?: string[] } | undefined) {
  return user?.permissions || [];
}

function has(user: { permissions?: string[] } | undefined, code: string) {
  return perms(user).includes(code);
}

async function main() {
  const h = new Harness();
  console.log('TripSheet RBAC persona architecture tests (Chapter 2 / Phase 5)');
  console.log(`Gateway  ${h.gateway}`);
  console.log(
    `Mode     ${USE_EXISTING ? 'existing tenant' : 'provision ephemeral company'}${KEEP ? ' (keep fixtures)' : ''}`,
  );

  let superToken = '';
  let company: CompanyFix | null = null;
  const tag = randTag();
  const pw = `Test${tag}9!`;

  try {
    h.suite('0. Health');
    await h.check('gateway /health', async () => {
      const r = await h.get('/health');
      h.okStatus(r.status, 'gateway');
    });
    h.endSuite();
    if (h.failed) {
      throw new Error(
        `gateway not reachable at ${h.gateway} — start backend (cd backend && npm run start:dev) then re-run npm run test:rbac:live`,
      );
    }

    h.suite('1. Super Admin is platform-only');
    await h.check('superadmin login (empty permissions)', async () => {
      const { token, user } = await h.login(SUPER_EMAIL, SUPER_PASS);
      superToken = token;
      h.eq(user.role, 'superadmin', 'role');
      h.eq(perms(user).length, 0, 'superadmin JWT must not carry tenant grants');
    });
    h.endSuite();
    if (h.failed) {
      throw new Error(
        'superadmin login failed — apply auth-service Prisma migrations (npx prisma migrate deploy) and retry',
      );
    }

    h.suite('2. Company fixture');
    await h.check('bind company + owner', async () => {
      company = USE_EXISTING
        ? await resolveCompanyOwner(h, superToken)
        : await createEphemeral(h, superToken, tag, pw);
      h.truthy(company.id, 'companyId');
      h.truthy(company.token, 'owner token');
    });
    h.endSuite();
    if (h.failed || !company) {
      throw new Error('company fixture failed — aborting remaining suites');
    }

    const co = () => {
      if (!company) throw new Error('no company fixture');
      return company;
    };

    h.suite('3. Owner JWT (2.10 admin)');
    await h.check('owner has users.create + assign_role + company.delete', async () => {
      const r = await h.get<{
        role?: string;
        permissions?: string[];
      }>('/api/auth/me', co().token);
      h.okStatus(r.status, 'me');
      h.eq(r.body?.role, 'company_owner', 'role');
      h.truthy(has(r.body, 'users.create'), 'users.create');
      h.truthy(has(r.body, 'users.assign_role'), 'users.assign_role');
      h.truthy(has(r.body, 'company.delete'), 'company.delete');
    });
    await h.check('owner cannot POST /api/companies (platform)', async () => {
      const r = await h.post('/api/companies', { name: 'Nope' }, co().token);
      h.eq(r.status, 403, 'platform create');
    });
    h.endSuite();

    const dispEmail = `disp-${tag}@rbac-test.local`;
    const acctEmail = `acct-${tag}@rbac-test.local`;
    const drvEmail = `drv-${tag}@rbac-test.local`;
    const otherEmail = `drv2-${tag}@rbac-test.local`;
    let dispToken = '';
    let acctToken = '';
    let drvToken = '';
    let drvUserId = '';
    let drvRecordId = '';
    let otherRecordId = '';
    let loadMine = '';
    let loadOther = '';

    h.suite('4. 2.10 #1 — create dispatcher (role permissions only)');
    await h.check('owner POST staff invite (dispatcher)', async () => {
      const r = await h.post<{ token?: string }>(
        '/api/invites',
        {
          companyId: co().id,
          kind: 'staff',
          role: 'dispatcher',
          email: `inv-${tag}@rbac-test.local`,
          name: 'Invite Dispatcher',
        },
        co().token,
      );
      h.okStatus(r.status, 'staff invite');
      h.truthy(r.body?.token, 'invite token');
    });
    await h.check('owner creates dispatcher user', async () => {
      const r = await h.post<{ id?: string; role?: string; permissions?: string[] }>(
        '/api/auth/users',
        {
          name: 'RBAC Dispatcher',
          email: dispEmail,
          password: pw,
          role: 'dispatcher',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(r.status, 'create dispatcher');
      h.eq(r.body?.role, 'dispatcher', 'role');
    });
    await h.check('dispatcher login grants dispatch.create, not wage/payroll', async () => {
      const { token, user } = await h.login(dispEmail, pw);
      dispToken = token;
      h.eq(user.role, 'dispatcher', 'role');
      h.truthy(has(user, 'dispatch.create'), 'dispatch.create');
      h.truthy(has(user, 'dispatch.view'), 'dispatch.view');
      h.eq(has(user, 'drivers.wage.edit'), false, 'no wage.edit');
      h.eq(has(user, 'payroll.process'), false, 'no payroll');
      h.eq(has(user, 'accounting.view'), false, 'no accounting');
      h.eq(has(user, 'company.delete'), false, 'no company.delete');
    });
    h.endSuite();

    h.suite('5. Accountant + driver users');
    await h.check('owner creates accountant', async () => {
      const r = await h.post(
        '/api/auth/users',
        {
          name: 'RBAC Accountant',
          email: acctEmail,
          password: pw,
          role: 'accountant',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(r.status, 'create accountant');
    });
    await h.check('accountant login: dispatch.view, not dispatch.edit', async () => {
      const { token, user } = await h.login(acctEmail, pw);
      acctToken = token;
      h.eq(user.role, 'accountant', 'role');
      h.truthy(has(user, 'dispatch.view'), 'dispatch.view');
      h.eq(has(user, 'dispatch.edit'), false, 'no dispatch.edit');
      h.eq(has(user, 'dispatch.create'), false, 'no dispatch.create');
      h.truthy(has(user, 'accounting.view'), 'accounting.view');
    });
    await h.check('owner creates driver login + record', async () => {
      const u = await h.post<{ id?: string }>(
        '/api/auth/users',
        {
          name: 'RBAC Driver',
          email: drvEmail,
          password: pw,
          role: 'driver',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(u.status, 'create driver user');
      drvUserId = String(u.body?.id || '');
      const rec = await h.post<{ id?: string }>(
        '/api/drivers',
        {
          companyId: co().id,
          name: 'RBAC Driver',
          email: drvEmail,
          userId: drvUserId,
        },
        co().token,
      );
      h.okStatus(rec.status, 'create driver record');
      drvRecordId = String(rec.body?.id || '');
      h.truthy(drvRecordId, 'driver record id');
    });
    await h.check('second driver record (other loads)', async () => {
      const u = await h.post<{ id?: string }>(
        '/api/auth/users',
        {
          name: 'RBAC Driver Two',
          email: otherEmail,
          password: pw,
          role: 'driver',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(u.status, 'driver 2 user');
      const rec = await h.post<{ id?: string }>(
        '/api/drivers',
        {
          companyId: co().id,
          name: 'RBAC Driver Two',
          email: otherEmail,
          userId: u.body?.id,
        },
        co().token,
      );
      h.okStatus(rec.status, 'driver 2 record');
      otherRecordId = String(rec.body?.id || '');
    });
    await h.check('driver login includes driverId', async () => {
      const { token, user } = await h.login(drvEmail, pw);
      drvToken = token;
      h.eq(user.role, 'driver', 'role');
      h.truthy(user.driverId, 'JWT driverId');
      h.eq(String(user.driverId), drvRecordId, 'driverId matches record');
    });
    h.endSuite();

    h.suite('6. Dispatch matrix');
    await h.check('dispatcher creates two loads', async () => {
      const a = await h.post<{ id?: string }>(
        '/api/loads',
        {
          companyId: co().id,
          driverId: drvRecordId,
          origin: 'Calgary',
          destination: 'Edmonton',
        },
        dispToken,
      );
      h.okStatus(a.status, 'load mine');
      loadMine = String(a.body?.id || '');
      const b = await h.post<{ id?: string }>(
        '/api/loads',
        {
          companyId: co().id,
          driverId: otherRecordId,
          origin: 'Red Deer',
          destination: 'Lethbridge',
        },
        dispToken,
      );
      h.okStatus(b.status, 'load other');
      loadOther = String(b.body?.id || '');
    });
    await h.check('accountant GET loads allowed', async () => {
      const r = await h.get<unknown[]>(
        `/api/loads?companyId=${encodeURIComponent(co().id)}`,
        acctToken,
      );
      h.okStatus(r.status, 'accountant GET');
      h.truthy(Array.isArray(r.body), 'array');
    });
    await h.check('accountant POST load denied at gateway', async () => {
      const r = await h.post(
        '/api/loads',
        {
          companyId: co().id,
          driverId: drvRecordId,
          origin: 'X',
          destination: 'Y',
        },
        acctToken,
      );
      h.eq(r.status, 403, 'accountant create');
    });
    await h.check('2.10 #3 accountant PATCH load 403', async () => {
      const r = await h.patch(
        `/api/loads/${loadMine}`,
        { notes: 'should not stick' },
        acctToken,
      );
      h.eq(r.status, 403, 'accountant edit');
    });
    await h.check('2.10 #3 audit rbac.deny', async () => {
      await sleep(400);
      const r = await h.get<Array<{ action?: string; entityType?: string }>>(
        `/api/audit?companyId=${encodeURIComponent(co().id)}&limit=50`,
        co().token,
      );
      h.okStatus(r.status, 'audit');
      const hit = (r.body || []).some((e) => e.action === 'rbac.deny');
      h.truthy(hit, 'expected rbac.deny on audit log');
    });
    await h.check('dispatcher cannot open wage contracts', async () => {
      const r = await h.get(
        `/api/contracts?driverId=${encodeURIComponent(drvRecordId)}`,
        dispToken,
      );
      h.eq(r.status, 403, 'dispatcher wage');
    });
    await h.check('owner can PATCH load', async () => {
      const r = await h.patch(
        `/api/loads/${loadMine}`,
        { notes: 'owner ok' },
        co().token,
      );
      h.okStatus(r.status, 'owner patch');
    });
    h.endSuite();

    h.suite('7. 2.10 #2 — driver self-scope');
    await h.check('driver GET loads only own', async () => {
      const r = await h.get<Array<{ id?: string; driverId?: string }>>(
        `/api/loads?companyId=${encodeURIComponent(co().id)}`,
        drvToken,
      );
      h.okStatus(r.status, 'driver GET');
      const ids = (r.body || []).map((l) => l.id);
      h.truthy(ids.includes(loadMine), 'sees own load');
      h.eq(ids.includes(loadOther), false, 'must not see other driver load');
      for (const l of r.body || []) {
        h.eq(l.driverId, drvRecordId, 'scoped driverId');
      }
    });
    await h.check('driver cannot GET another driver’s load', async () => {
      const r = await h.get(`/api/loads/${loadOther}`, drvToken);
      h.eq(r.status, 403, 'other load');
    });
    await h.check('driver cannot create dispatch', async () => {
      const r = await h.post(
        '/api/loads',
        {
          companyId: co().id,
          driverId: drvRecordId,
          origin: 'A',
          destination: 'B',
        },
        drvToken,
      );
      h.eq(r.status, 403, 'driver create');
    });
    h.endSuite();

    h.suite('8. Custom role (Phase 3)');
    await h.check('owner composes a view-only dispatch role', async () => {
      const created = await h.post<{ id?: string }>(
        `/api/companies/${co().id}/custom-roles`,
        {
          name: `View only ${tag}`,
          description: 'Phase 5 persona suite',
          baseRole: 'dispatcher',
          permissions: ['dispatch.view', 'reports.view'],
        },
        co().token,
      );
      if (created.status >= 400) {
        throw new Error(
          `custom-role HTTP ${created.status} ${created.raw.slice(0, 240)}`,
        );
      }
      const roleId = String(created.body?.id || '');
      const disp = await h.login(dispEmail, pw);
      const patch = await h.patch(
        `/api/auth/users/${disp.user.id}`,
        { customRoleId: roleId },
        co().token,
      );
      h.okStatus(patch.status, 'assign custom');
      const again = await h.login(dispEmail, pw);
      h.eq(has(again.user, 'dispatch.view'), true, 'keeps view');
      h.eq(has(again.user, 'dispatch.create'), false, 'lost create');
      h.eq(has(again.user, 'dispatch.edit'), false, 'lost edit');
      dispToken = again.token;
    });
    await h.check('custom-role dispatcher cannot PATCH load', async () => {
      const r = await h.patch(
        `/api/loads/${loadMine}`,
        { notes: 'custom should deny' },
        dispToken,
      );
      h.eq(r.status, 403, 'custom role edit');
    });
    h.endSuite();

    const gmEmail = `gm-${tag}@rbac-test.local`;
    const fleetEmail = `fleet-${tag}@rbac-test.local`;
    const lockEmail = `lock-${tag}@rbac-test.local`;
    const sessEmail = `sess-${tag}@rbac-test.local`;
    const lockPw = 'Zynp9!AbcdXyzq';
    const sessPw = 'Qwrp9!AbcdXyzq';
    let gmToken = '';
    let fleetToken = '';
    let sessToken = '';

    h.suite('9. Other system personas');
    await h.check('GM has operations, not company.delete', async () => {
      const r = await h.post(
        '/api/auth/users',
        {
          name: 'RBAC GM',
          email: gmEmail,
          password: pw,
          role: 'general_manager',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(r.status, 'create GM');
      const { token, user } = await h.login(gmEmail, pw);
      gmToken = token;
      h.eq(user.role, 'general_manager', 'role');
      h.truthy(has(user, 'dispatch.create'), 'dispatch.create');
      h.truthy(has(user, 'users.create'), 'users.create');
      h.eq(has(user, 'company.delete'), false, 'no company.delete');
    });
    await h.check('GM cannot POST /api/companies', async () => {
      const r = await h.post('/api/companies', { name: 'Nope' }, gmToken);
      h.eq(r.status, 403, 'GM platform create');
    });
    await h.check('fleet manager: fleet yes, dispatch create no, wage no', async () => {
      const r = await h.post(
        '/api/auth/users',
        {
          name: 'RBAC Fleet',
          email: fleetEmail,
          password: pw,
          role: 'fleet_manager',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(r.status, 'create fleet');
      const { token, user } = await h.login(fleetEmail, pw);
      fleetToken = token;
      h.eq(user.role, 'fleet_manager', 'role');
      h.truthy(has(user, 'fleet.edit'), 'fleet.edit');
      h.eq(has(user, 'dispatch.create'), false, 'no dispatch.create');
      h.eq(has(user, 'drivers.wage.view'), false, 'no wage.view');
    });
    await h.check('fleet manager GET assets allowed', async () => {
      const r = await h.get(
        `/api/assets?companyId=${encodeURIComponent(co().id)}`,
        fleetToken,
      );
      h.okStatus(r.status, 'fleet GET assets');
    });
    await h.check('fleet manager POST load denied', async () => {
      const r = await h.post(
        '/api/loads',
        {
          companyId: co().id,
          driverId: drvRecordId,
          origin: 'A',
          destination: 'B',
        },
        fleetToken,
      );
      h.eq(r.status, 403, 'fleet create load');
    });
    h.endSuite();

    h.suite('10. Phase 4 auth hardening');
    await h.check('owner tightens lockout + complexity', async () => {
      const r = await h.patch(
        `/api/companies/${co().id}/security-policy`,
        {
          lockoutThreshold: 3,
          lockoutMinutes: 1,
          passwordComplexity: true,
          passwordMinLength: 12,
        },
        co().token,
      );
      h.okStatus(r.status, 'patch policy');
    });
    await h.check('new user rejected for weak password', async () => {
      const r = await h.post(
        '/api/auth/users',
        {
          name: 'Weak PW',
          email: `weak-${tag}@rbac-test.local`,
          password: 'short1',
          role: 'dispatcher',
          companyId: co().id,
        },
        co().token,
      );
      h.eq(r.status >= 400, true, 'weak password must fail');
    });
    await h.check('lockout after threshold failed logins', async () => {
      const created = await h.post(
        '/api/auth/users',
        {
          name: 'Lockout User',
          email: lockEmail,
          password: lockPw,
          role: 'dispatcher',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(created.status, 'create lockout user');
      for (let i = 0; i < 3; i++) {
        const bad = await h.post('/api/auth/login', {
          email: lockEmail,
          password: 'wrong-password',
        });
        h.eq(bad.status, 401, `fail ${i + 1}`);
      }
      const locked = await h.post('/api/auth/login', {
        email: lockEmail,
        password: lockPw,
      });
      h.eq(locked.status, 401, 'correct password still locked');
      h.truthy(/locked/i.test(locked.raw), 'body mentions locked');
    });
    await h.check('owner company login-history includes lockout', async () => {
      const r = await h.get<Array<{ reason?: string; email?: string }>>(
        `/api/auth/login-history?scope=company&companyId=${encodeURIComponent(co().id)}`,
        co().token,
      );
      h.okStatus(r.status, 'company history');
      h.truthy(Array.isArray(r.body), 'array');
      const hit = (r.body || []).some(
        (e) => e.email === lockEmail && e.reason === 'lockout',
      );
      h.truthy(hit, 'expected lockout LoginEvent');
    });
    await h.check('dispatcher cannot read company-wide login history', async () => {
      const r = await h.get(
        `/api/auth/login-history?scope=company&companyId=${encodeURIComponent(co().id)}`,
        dispToken,
      );
      h.eq(r.status, 403, 'company history');
    });
    await h.check('logout-all revokes JWT on /auth/me', async () => {
      const created = await h.post<{ id?: string }>(
        '/api/auth/users',
        {
          name: 'Session User',
          email: sessEmail,
          password: sessPw,
          role: 'accountant',
          companyId: co().id,
        },
        co().token,
      );
      h.okStatus(created.status, 'create session user');
      const first = await h.login(sessEmail, sessPw);
      sessToken = first.token;
      const out = await h.post('/api/auth/logout-all', {}, sessToken);
      h.okStatus(out.status, 'logout-all');
      const me = await h.get('/api/auth/me', sessToken);
      h.eq(me.status, 401, 'stale token');
      h.truthy(/revoked|sign in/i.test(me.raw), 'revoked message');
    });
    await h.check('change-password issues a new token', async () => {
      const again = await h.login(sessEmail, sessPw);
      const next = 'Vypx9!AbcdXyzq';
      const changed = await h.post<{ accessToken?: string }>(
        '/api/auth/change-password',
        { currentPassword: sessPw, newPassword: next },
        again.token,
      );
      h.okStatus(changed.status, 'change-password');
      h.truthy(changed.body?.accessToken, 'new access token');
      const stale = await h.get('/api/auth/me', again.token);
      h.eq(stale.status, 401, 'old token after password change');
      const fresh = await h.get('/api/auth/me', changed.body!.accessToken);
      h.okStatus(fresh.status, 'new token me');
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
        console.log(`  dropped ${company.slug}`);
      } catch (e) {
        console.log(`  cleanup failed: ${String(e)}`);
      }
    } else if (company && (!USE_EXISTING && KEEP)) {
      console.log('\nKept company:');
      console.log(`  ${company.slug}  ${company.email} / ${company.password}`);
    }
    h.printSummary();
  }

  process.exit(h.failed ? 1 : 0);
}

async function createEphemeral(
  h: Harness,
  superToken: string,
  tag: string,
  password: string,
): Promise<CompanyFix> {
  const shortName = `R${tag}`.slice(0, 6).toUpperCase();
  const slug = shortName.toLowerCase();
  const email = `owner-${slug}@rbac-test.local`;

  const created = await h.post<{
    id?: string;
    slug?: string;
    tenantDatabase?: { status?: string };
  }>(
    '/api/companies',
    {
      name: `RBAC Test ${shortName}`,
      shortName,
      slug,
      planCode: 'professional',
      tagline: 'rbac-persona-test',
    },
    superToken,
  );
  if (created.status >= 400 || !created.body?.id) {
    throw new Error(
      `create company: HTTP ${created.status} ${created.raw.slice(0, 300)}`,
    );
  }
  const id = created.body.id;

  const user = await h.post(
    '/api/auth/users',
    {
      name: `${shortName} Owner`,
      email,
      password,
      role: 'company_owner',
      companyId: id,
    },
    superToken,
  );
  if (user.status >= 400) {
    throw new Error(`create owner: HTTP ${user.status} ${user.raw.slice(0, 240)}`);
  }

  const tenant = await h.poll(
    () => h.get<TenantRow>(`/api/tenants/${id}`, superToken),
    (r) => r.status < 500 && r.body?.status === 'active',
    { timeoutMs: 120_000, label: `${slug} provisioned` },
  );
  if (tenant.body?.status !== 'active') {
    throw new Error(
      `provision ${slug}: ${tenant.body?.status} ${tenant.body?.lastError || ''}`,
    );
  }

  await sleep(300);
  await h.patch(
    `/api/tenants/${id}/routing-mode`,
    { routingMode: 'tenant' },
    superToken,
  );

  const { token } = await h.login(email, password);
  return {
    id,
    slug: created.body.slug || slug,
    email,
    password,
    token,
    ephemeral: true,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
