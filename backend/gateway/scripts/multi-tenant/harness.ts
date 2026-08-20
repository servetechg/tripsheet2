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

  okStatus(status: number, hint: string) {
    if (status < 200 || status >= 300) {
      throw new Error(`${hint}: HTTP ${status}`);
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
