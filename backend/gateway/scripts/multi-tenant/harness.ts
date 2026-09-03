/**
 * HTTP + assertion helpers for multi-tenant architecture tests.
 */
export type HttpResult<T = unknown> = {
  status: number;
  body: T;
  raw: string;
};

export class SkipError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipError';
  }
}

export class Harness {
  readonly gateway: string;
  passed = 0;
  failed = 0;
  skipped = 0;
  readonly failures: string[] = [];
  private readonly suiteStack: string[] = [];

  constructor(gateway = process.env.GATEWAY_URL || 'http://localhost:3000') {
    this.gateway = gateway.replace(/\/$/, '');
  }

  suite(name: string) {
    this.suiteStack.push(name);
    console.log(`\n▸ ${name}`);
  }

  endSuite() {
    this.suiteStack.pop();
  }

  private label(name: string) {
    const prefix = this.suiteStack.length
      ? `${this.suiteStack[this.suiteStack.length - 1]} · `
      : '';
    return prefix + name;
  }

  async check(name: string, fn: () => Promise<void> | void) {
    const label = this.label(name);
    try {
      await fn();
      this.passed += 1;
      console.log(`  PASS  ${label}`);
    } catch (e) {
      if (e instanceof SkipError) {
        this.skipped += 1;
        console.log(`  SKIP  ${label} (${e.message})`);
        return;
      }
      this.failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      this.failures.push(`${label}: ${msg}`);
      console.log(`  FAIL  ${label}`);
      console.log(`        ${msg}`);
    }
  }

  skip(name: string, reason: string) {
    this.skipped += 1;
    console.log(`  SKIP  ${this.label(name)} (${reason})`);
  }

  eq<T>(actual: T, expected: T, hint = '') {
    if (actual !== expected) {
      throw new Error(
        `${hint ? hint + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }

  truthy(v: unknown, hint: string) {
    if (!v) throw new Error(hint);
  }

  okStatus(status: number, hint: string, raw?: string) {
    if (status < 200 || status >= 300) {
      throw new Error(
        `${hint}: HTTP ${status}${raw ? ` ${raw.slice(0, 240)}` : ''}`,
      );
    }
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts?: {
      token?: string;
      body?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<HttpResult<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts?.headers || {}),
    };
    if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
    let payload: string | undefined;
    if (opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }
    const res = await fetch(`${this.gateway}${path}`, {
      method,
      headers,
      body: payload,
    });
    const raw = await res.text();
    let body: T;
    try {
      body = raw ? (JSON.parse(raw) as T) : (null as T);
    } catch {
      body = raw as T;
    }
    return { status: res.status, body, raw };
  }

  get<T = unknown>(
    path: string,
    token?: string,
    headers?: Record<string, string>,
  ) {
    return this.request<T>('GET', path, { token, headers });
  }

  post<T = unknown>(path: string, body: unknown, token?: string) {
    return this.request<T>('POST', path, { token, body });
  }

  patch<T = unknown>(path: string, body: unknown, token?: string) {
    return this.request<T>('PATCH', path, { token, body });
  }

  del<T = unknown>(path: string, token?: string) {
    return this.request<T>('DELETE', path, { token });
  }

  async login(email: string, password: string) {
    const r = await this.post<{
      accessToken?: string;
      user?: {
        id?: string;
        role?: string;
        companyId?: string | null;
        tenantKey?: string | null;
        email?: string;
        name?: string;
        permissions?: string[];
        driverId?: string | null;
        customRoleId?: string | null;
      };
    }>('/api/auth/login', { email, password });
    if (r.status >= 400 || !r.body?.accessToken) {
      throw new Error(
        `login ${email} failed: HTTP ${r.status} ${r.raw.slice(0, 240)}`,
      );
    }
    return {
      token: r.body.accessToken,
      user: r.body.user || {},
    };
  }

  async poll<T>(
    fn: () => Promise<T>,
    ok: (v: T) => boolean,
    opts?: { timeoutMs?: number; intervalMs?: number; label?: string },
  ): Promise<T> {
    const timeoutMs = opts?.timeoutMs ?? 90_000;
    const intervalMs = opts?.intervalMs ?? 1500;
    const start = Date.now();
    let last: T | undefined;
    while (Date.now() - start < timeoutMs) {
      last = await fn();
      if (ok(last)) return last;
      await sleep(intervalMs);
    }
    throw new Error(
      `timeout waiting for ${opts?.label || 'condition'} after ${timeoutMs}ms; last=${JSON.stringify(last)?.slice(0, 300)}`,
    );
  }

  printSummary() {
    console.log('\n────────────────────────────────────────');
    console.log(
      `  ${this.passed} passed, ${this.failed} failed, ${this.skipped} skipped`,
    );
    if (this.failures.length) {
      console.log('  Failures:');
      for (const f of this.failures) console.log(`    - ${f}`);
    }
    console.log('────────────────────────────────────────');
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randTag() {
  return Math.random().toString(36).slice(2, 6);
}

/** Seeded company owners for local `--existing` live tests. */
export const SEEDED_COMPANY_ADMINS: Record<
  string,
  { email: string; password: string }
> = {
  mkx: { email: 'admin@mkx.ca', password: 'mkx123' },
};

export type CompanyOwnerFixture = {
  id: string;
  slug: string;
  email: string;
  password: string;
  token: string;
  ephemeral: false;
};

/**
 * Bind an existing company owner for live tests.
 * Prefers env credentials, then tenant list slug, then MKX seed fallback.
 */
export async function resolveCompanyOwner(
  h: Harness,
  superToken: string,
): Promise<CompanyOwnerFixture> {
  const envEmail =
    process.env.MDM_OWNER_EMAIL ||
    process.env.DRIVER_OWNER_EMAIL ||
    process.env.AUTH_OWNER_EMAIL ||
    process.env.RBAC_OWNER_EMAIL;
  const envPass =
    process.env.MDM_OWNER_PASSWORD ||
    process.env.DRIVER_OWNER_PASSWORD ||
    process.env.AUTH_OWNER_PASSWORD ||
    process.env.RBAC_OWNER_PASSWORD;
  if (envEmail && envPass) {
    const { token, user } = await h.login(envEmail, envPass);
    if (!user.companyId) throw new Error('owner has no companyId');
    return {
      id: user.companyId,
      slug: 'existing',
      email: envEmail,
      password: envPass,
      token,
      ephemeral: false,
    };
  }

  type TenantRow = {
    companyId: string;
    status?: string;
    company?: { slug?: string };
  };
  const r = await h.get<TenantRow[]>('/api/tenants', superToken);
  const active = (Array.isArray(r.body) ? r.body : []).filter(
    (t) => t.status === 'active' && t.company?.slug,
  );
  const slug = active[0]?.company?.slug || 'mkx';
  const known =
    SEEDED_COMPANY_ADMINS[slug] || SEEDED_COMPANY_ADMINS.mkx;
  const email =
    process.env[`ADMIN_${slug.toUpperCase()}_EMAIL`] || known.email;
  const password =
    process.env[`ADMIN_${slug.toUpperCase()}_PASSWORD`] || known.password;
  const { token, user } = await h.login(email, password);
  return {
    id: user.companyId || active[0]?.companyId || 'c1',
    slug,
    email,
    password,
    token,
    ephemeral: false,
  };
}

/** Create an active driver with license/medical/abstract docs for dispatch gates. */
export async function seedActiveDriverWithCompliance(
  h: Harness,
  token: string,
  companyId: string,
  tag: string,
): Promise<string> {
  const email = `mdm-drv-${tag}@driver-test.local`;
  const created = await h.post<{ id?: string }>(
    '/api/drivers',
    {
      companyId,
      name: `MDM Driver ${tag}`,
      email,
      lifecycleStatus: 'active',
      licenseNo: `MDM-LIC-${tag}`,
    },
    token,
  );
  if (created.status < 200 || created.status >= 300 || !created.body?.id) {
    throw new Error(
      `seed driver failed: HTTP ${created.status} ${created.raw.slice(0, 200)}`,
    );
  }
  const driverId = created.body.id;
  for (const type of ['license', 'medical', 'abstract'] as const) {
    const doc = await h.post(
      '/api/documents',
      {
        driverId,
        companyId,
        type,
        fileName: `${type}.pdf`,
        status: 'uploaded',
        expiryDate: '2099-06-01',
      },
      token,
    );
    if (doc.status < 200 || doc.status >= 300) {
      throw new Error(`seed doc ${type}: HTTP ${doc.status}`);
    }
  }
  const ready = await h.get<{ ready?: boolean; missing?: string[] }>(
    `/api/drivers/${driverId}/dispatch-ready`,
    token,
  );
  if (!ready.body?.ready) {
    throw new Error(
      `driver not dispatch-ready: ${JSON.stringify(ready.body?.missing)}`,
    );
  }
  return driverId;
}

export type TenantFixture = {
  id: string;
  slug: string;
  dbName: string;
  email: string;
  password: string;
  token: string;
  tenantKey: string;
  ephemeral: false;
};

/** Bind N existing active tenants for multi-tenant live tests. */
export async function resolveExistingTenants(
  h: Harness,
  _superToken: string,
  count = 2,
): Promise<TenantFixture[]> {
  type TenantRow = {
    companyId: string;
    dbName?: string;
    status?: string;
    company?: { slug?: string };
  };
  const r = await h.get<TenantRow[]>('/api/tenants', _superToken);
  const active = (Array.isArray(r.body) ? r.body : []).filter(
    (t) => t.status === 'active' && t.company?.slug,
  );
  if (active.length < count) {
    throw new Error(
      `need ≥${count} active tenants for --existing (found ${active.length})`,
    );
  }
  const out: TenantFixture[] = [];
  for (const row of active.slice(0, count)) {
    const slug = row.company!.slug!;
    const known =
      SEEDED_COMPANY_ADMINS[slug] || SEEDED_COMPANY_ADMINS.mkx;
    const email =
      process.env[`ADMIN_${slug.toUpperCase()}_EMAIL`] || known.email;
    const password =
      process.env[`ADMIN_${slug.toUpperCase()}_PASSWORD`] || known.password;
    const { token, user } = await h.login(email, password);
    out.push({
      id: row.companyId,
      slug,
      dbName: row.dbName || `fq_tenant_${slug}`,
      email,
      password,
      token,
      tenantKey: String(user.tenantKey || slug),
      ephemeral: false,
    });
  }
  return out;
}

/** Apply org SQL + ops Prisma push on one tenant (company-service internal). */
export async function ensureTenantSchemas(companyId: string) {
  const base =
    process.env.COMPANY_SERVICE_URL || 'http://localhost:3002';
  const key =
    process.env.INTERNAL_API_KEY || 'tripsheet-internal-dev';
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1500);
    const res = await fetch(
      `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/ensure-driver-schema`,
      {
        method: 'POST',
        headers: { 'x-internal-api-key': key },
      },
    );
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        pushOk?: boolean | 'skipped';
        pushError?: string;
      };
      if (body.pushOk === false) {
        lastErr = body.pushError || `push failed for ${companyId}`;
        continue;
      }
      return;
    }
    lastErr = await res.text().catch(() => `HTTP ${res.status}`);
  }
  throw new Error(
    `ensureTenantSchemas ${companyId}: ${lastErr.slice(0, 240)}`,
  );
}
