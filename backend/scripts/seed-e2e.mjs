#!/usr/bin/env node
/**
 * Idempotent E2E fixture: MKX company + owner + driver (Playwright accounts).
 * Usage: node scripts/seed-e2e.mjs
 * Requires gateway on :3000 and super admin seeded (admin@tripsheet.io / admin123).
 */
const GATEWAY = (process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/$/, '');
const API = `${GATEWAY}/api`;

const MKX = {
  name: 'MKX Logistics',
  shortName: 'MKX',
  slug: 'mkx',
  planCode: 'enterprise',
  owner: {
    name: 'MKX Admin',
    email: 'admin@mkx.ca',
    password: 'mkx123',
    role: 'company_owner',
  },
  driver: {
    name: 'Divyam Driver',
    email: 'divyam@mkx.ca',
    password: 'driver123',
    role: 'driver',
  },
};

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
  if (res.status >= 400) {
    throw new Error(`${method} ${path} → ${res.status}: ${raw.slice(0, 400)}`);
  }
  return parsed;
}

async function login(email, password) {
  const res = await req('POST', '/auth/login', {
    body: { email, password },
  });
  if (res?.mfaRequired) {
    throw new Error(`MFA required for ${email} — disable MFA on E2E accounts`);
  }
  return res.accessToken;
}

async function waitTenant(token, companyId, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await req('GET', `/tenants/${companyId}`, { token });
    if (row?.status === 'active') return row;
    if (row?.status === 'failed') {
      throw new Error(`Tenant provision failed: ${row.lastError || 'unknown'}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Tenant ${companyId} not active within ${timeoutMs}ms`);
}

async function ensureUser(token, user, companyId) {
  const users = await req('GET', '/auth/users', { token });
  const existing = users.find(
    (u) => u.email?.toLowerCase() === user.email.toLowerCase(),
  );
  if (existing) return existing;
  return req('POST', '/auth/users', {
    token,
    body: {
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      companyId,
    },
  });
}

async function ensureDriver(token, companyId, driverUser) {
  const rows = await req(
    'GET',
    `/drivers?companyId=${encodeURIComponent(companyId)}`,
    { token },
  );
  const existing = rows.find(
    (d) =>
      d.email?.toLowerCase() === driverUser.email.toLowerCase() ||
      d.userId === driverUser.id,
  );
  if (existing) return existing;
  return req('POST', '/drivers', {
    token,
    body: {
      companyId,
      name: driverUser.name,
      email: driverUser.email,
      userId: driverUser.id,
      lifecycleStatus: 'active',
      availabilityStatus: 'available',
    },
  });
}

async function main() {
  console.log(`==> E2E seed via ${API}`);
  const superToken = await login('admin@tripsheet.io', 'admin123');

  const companies = await req('GET', '/companies', { token: superToken });
  let company = companies.find((c) => c.slug === MKX.slug);

  if (!company) {
    console.log('Creating MKX company…');
    company = await req('POST', '/companies', {
      token: superToken,
      body: {
        name: MKX.name,
        shortName: MKX.shortName,
        tagline: 'E2E test tenant',
        address: 'Calgary, AB',
        planCode: MKX.planCode,
        active: true,
      },
    });
  } else {
    console.log(`MKX company exists (${company.id})`);
  }

  const owner = await ensureUser(superToken, MKX.owner, company.id);
  console.log(`Owner: ${owner.email}`);

  const driverUser = await ensureUser(superToken, MKX.driver, company.id);
  console.log(`Driver user: ${driverUser.email}`);

  const tenant = await waitTenant(superToken, company.id);
  console.log(`Tenant DB: ${tenant.dbName} (${tenant.status})`);

  const ownerToken = await login(MKX.owner.email, MKX.owner.password);
  const driver = await ensureDriver(ownerToken, company.id, driverUser);
  console.log(`Driver record: ${driver.id} (${driver.name})`);

  console.log('==> E2E seed complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
