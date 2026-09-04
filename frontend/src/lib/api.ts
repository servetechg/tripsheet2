const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('ts_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = localStorage.getItem('ts_refresh');
  if (!refresh) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as {
          accessToken?: string;
          refreshToken?: string;
        };
        if (!body.accessToken || !body.refreshToken) return false;
        setTokens(body.accessToken, body.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function api<T>(
  path: string,
  options: RequestInit & { skipAuthRefresh?: boolean } = {},
): Promise<T> {
  const { skipAuthRefresh, ...init } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const isAuthPath =
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/refresh') ||
      path.startsWith('/auth/mfa/challenge') ||
      path.startsWith('/auth/mfa/enroll-login') ||
      path.startsWith('/auth/forgot-password') ||
      path.startsWith('/auth/reset-password');
    if (res.status === 401 && !skipAuthRefresh && !isAuthPath) {
      const ok = await tryRefreshAccessToken();
      if (ok) {
        return api<T>(path, { ...options, skipAuthRefresh: true });
      }
    }
    let body: unknown = null;
    const text = await res.text().catch(() => res.statusText);
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (res.status === 401) {
      clearTokens();
      window.dispatchEvent(new Event('ts:auth-expired'));
    }
    let msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : text || res.statusText;
    if (
      res.status === 503 &&
      typeof body === 'object' &&
      body &&
      'detail' in body &&
      (body as { detail?: unknown }).detail
    ) {
      msg = String((body as { detail: unknown }).detail);
    }
    throw new ApiError(res.status, msg, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Returns true if gateway is reachable */
export async function pingApi(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE.replace(/\/api$/, '')}/health`, {
      method: 'GET',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type ServiceHealth = {
  name: string;
  ok: boolean;
  status?: number;
  error?: string;
};

/** Gateway aggregate check — lists downstream services that are down. */
export async function checkBackendServices(): Promise<{
  ok: boolean;
  down: string[];
  services: ServiceHealth[];
}> {
  try {
    const res = await fetch(`${BASE.replace(/\/api$/, '')}/health/services`, {
      method: 'GET',
    });
    if (!res.ok) return { ok: false, down: [], services: [] };
    const body = (await res.json()) as {
      down?: string[];
      services?: ServiceHealth[];
    };
    const down = body.down || [];
    return { ok: down.length === 0, down, services: body.services || [] };
  } catch {
    return { ok: false, down: [], services: [] };
  }
}

export type SessionDto = {
  id?: string;
  sessionDays: number;
  accessTokenMinutes?: number;
  idleTimeoutMinutes: number;
  passwordPolicy?: {
    minLength: number;
    complexity: boolean;
    historyCount?: number;
    hint: string;
  };
  mfaRequired: boolean;
  mfaEnabled?: boolean;
  /** Company policy: MFA enrollment required at login. */
  requireMfa: boolean;
  idleNote?: string;
};

export type DeviceSessionDto = {
  id: string;
  deviceLabel: string;
  userAgent: string;
  ip: string;
  trusted: boolean;
  current: boolean;
  active: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokeReason: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUserDto;
  session?: SessionDto;
  recoveryCodes?: string[];
};

export type LoginResult =
  | AuthTokens
  | {
      mfaRequired: true;
      mfaToken: string;
      message?: string;
    }
  | {
      mfaEnrollmentRequired: true;
      mfaToken: string;
      message?: string;
    };

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  status?: string;
  lockedUntil?: string | null;
  suspendedAt?: string | null;
  archivedAt?: string | null;
  tenantKey?: string | null;
  permissions?: string[];
  customRoleId?: string | null;
  customRoleName?: string | null;
  driverId?: string | null;
  mfaEnabled?: boolean;
  session?: SessionDto;
  createdAt?: string;
  updatedAt?: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    api<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<AuthUserDto>('/auth/me'),
  mfaChallenge: (mfaToken: string, code: string) =>
    api<AuthTokens>('/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code }),
      skipAuthRefresh: true,
    }),
  mfaEnrollLoginStart: (mfaToken: string) =>
    api<{
      secret: string;
      otpauthUrl: string;
      qrCodeDataUrl?: string;
      mfaToken: string;
      message?: string;
    }>('/auth/mfa/enroll-login/start', {
      method: 'POST',
      body: JSON.stringify({ mfaToken }),
      skipAuthRefresh: true,
    }),
  mfaEnrollLoginConfirm: (mfaToken: string, code: string) =>
    api<AuthTokens & { recoveryCodes?: string[] }>(
      '/auth/mfa/enroll-login/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ mfaToken, code }),
        skipAuthRefresh: true,
      },
    ),
  mfaStatus: () =>
    api<{
      mfaEnabled: boolean;
      recoveryCodesRemaining: number;
      companyRequiresMfa: boolean;
    }>('/auth/mfa/status'),
  mfaEnrollStart: () =>
    api<{
      secret: string;
      otpauthUrl: string;
      qrCodeDataUrl?: string;
      message?: string;
    }>('/auth/mfa/enroll/start', { method: 'POST', body: '{}' }),
  mfaEnrollConfirm: (code: string, password?: string) =>
    api<{
      ok: boolean;
      mfaEnabled: boolean;
      recoveryCodes: string[];
      message?: string;
    }>('/auth/mfa/enroll/confirm', {
      method: 'POST',
      body: JSON.stringify({ code, password }),
    }),
  mfaDisable: (password: string, code: string) =>
    api<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),
  mfaRegenerateRecovery: (password: string, code: string) =>
    api<{ ok: boolean; recoveryCodes: string[]; message?: string }>(
      '/auth/mfa/recovery/regenerate',
      {
        method: 'POST',
        body: JSON.stringify({ password, code }),
      },
    ),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<AuthTokens>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: (refreshToken?: string) =>
    api<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    }),
  logoutAll: () => api<{ ok: boolean }>('/auth/logout-all', { method: 'POST' }),
  sessionHistory: (limit = 40) =>
    api<{
      sessions: DeviceSessionDto[];
      loginEvents: Array<{
        id: string;
        success: boolean;
        reason: string;
        ip: string;
        userAgent: string;
        createdAt: string;
      }>;
      idleNote: string;
    }>(`/auth/sessions/history?limit=${limit}`),
  patchSession: (
    id: string,
    body: { deviceLabel?: string; trusted?: boolean },
  ) =>
    api<{ id: string; deviceLabel: string; trusted: boolean }>(
      `/auth/sessions/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  revokeSession: (id: string) =>
    api<{ ok: boolean }>(`/auth/sessions/${id}/revoke`, {
      method: 'POST',
      body: '{}',
    }),
  forgotPassword: (email: string) =>
    api<{ ok: boolean; message?: string; resetUrl?: string }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) },
    ),
  resetPassword: (token: string, newPassword: string) =>
    api<{ ok: boolean; message?: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  loginHistory: (opts?: {
    userId?: string;
    scope?: 'company';
    limit?: number;
    companyId?: string;
  }) => {
    const q = new URLSearchParams();
    if (opts?.userId) q.set('userId', opts.userId);
    if (opts?.scope) q.set('scope', opts.scope);
    if (opts?.limit) q.set('limit', String(opts.limit));
    if (opts && 'companyId' in opts && opts.companyId) {
      q.set('companyId', String(opts.companyId));
    }
    const suffix = q.toString() ? `?${q}` : '';
    return api<
      Array<{
        id: string;
        email: string;
        success: boolean;
        reason: string;
        ip: string;
        userAgent: string;
        createdAt: string;
        userId?: string;
      }>
    >(`/auth/login-history${suffix}`);
  },
  securityEvents: (opts?: {
    scope?: 'self' | 'company';
    limit?: number;
    companyId?: string;
  }) => {
    const q = new URLSearchParams();
    if (opts?.scope) q.set('scope', opts.scope);
    if (opts?.limit) q.set('limit', String(opts.limit));
    if (opts?.companyId) q.set('companyId', opts.companyId);
    const suffix = q.toString() ? `?${q}` : '';
    return api<
      Array<{
        id: string;
        type: string;
        severity: string;
        message: string;
        ip: string;
        createdAt: string;
        userId?: string | null;
      }>
    >(`/auth/security-events${suffix}`);
  },
  listUsers: (companyId?: string) =>
    api<AuthUserDto[]>(
      companyId
        ? `/auth/users?companyId=${encodeURIComponent(companyId)}`
        : '/auth/users',
    ),
  createUser: (body: {
    email: string;
    password: string;
    name: string;
    role: string;
    companyId?: string | null;
  }) =>
    api<AuthUserDto>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    api<AuthUserDto>(`/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  setUserStatus: (
    id: string,
    status: 'active' | 'inactive' | 'suspended' | 'locked' | 'archived',
  ) =>
    api<AuthUserDto>(`/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  unlockUser: (id: string) =>
    api<AuthUserDto>(`/auth/users/${id}/unlock`, {
      method: 'POST',
      body: '{}',
    }),
  listRoles: () =>
    api<
      Array<{
        code: string;
        name: string;
        description: string;
        system: boolean;
        permissionCount: number;
        permissions?: string[];
      }>
    >('/auth/roles'),
  listPermissions: () =>
    api<Array<{ code: string; module: string; name: string; description: string }>>(
      '/auth/permissions',
    ),
};

export type CustomRoleDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string;
  baseRole: string;
  permissions: string[];
};

export const companiesApi = {
  list: () => api<any[]>('/companies'),
  get: (id: string) => api<any>(`/companies/${id}`),
  create: (body: unknown) =>
    api('/companies', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleActive: (id: string) =>
    api(`/companies/${id}/toggle-active`, { method: 'PATCH' }),
  changePlan: (id: string, planCode: string) =>
    api(`/companies/${id}/plan`, {
      method: 'POST',
      body: JSON.stringify({ planCode }),
    }),
  entitlements: (id: string) =>
    api<any>(`/companies/${encodeURIComponent(id)}/entitlements`),
  settings: (id: string) =>
    api<any>(`/companies/${encodeURIComponent(id)}/settings`),
  patchSettings: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  branding: (id: string) =>
    api<any>(`/companies/${encodeURIComponent(id)}/branding`),
  patchBranding: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/branding`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  branches: (id: string) =>
    api<any[]>(`/companies/${encodeURIComponent(id)}/branches`),
  saveBranch: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/branches`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteBranch: (id: string, branchId: string) =>
    api(
      `/companies/${encodeURIComponent(id)}/branches/${encodeURIComponent(branchId)}`,
      { method: 'DELETE' },
    ),
  locations: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/locations${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createLocation: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/locations`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchLocation: (id: string, locId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/locations/${encodeURIComponent(locId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  brokers: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/brokers${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createBroker: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/brokers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchBroker: (id: string, brokerId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/brokers/${encodeURIComponent(brokerId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  customers: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/customers${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createCustomer: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/customers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchCustomer: (id: string, customerId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/customers/${encodeURIComponent(customerId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  consignees: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/consignees${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createConsignee: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/consignees`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchConsignee: (id: string, consigneeId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/consignees/${encodeURIComponent(consigneeId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  carriers: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/carriers${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createCarrier: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/carriers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchCarrier: (id: string, carrierId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/carriers/${encodeURIComponent(carrierId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  mergeMdm: (
    id: string,
    body: { entityType: string; survivorId: string; absorbId: string },
  ) =>
    api(`/companies/${encodeURIComponent(id)}/mdm/merge`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  exportMdm: (id: string, entity: string) =>
    api<{ entity: string; filename: string; csv: string }>(
      `/companies/${encodeURIComponent(id)}/mdm/export?entity=${encodeURIComponent(entity)}`,
    ),
  importMdm: (
    id: string,
    body: { entity: string; csv: string; dryRun: boolean },
  ) =>
    api<{
      dryRun: boolean;
      entity: string;
      created: number;
      wouldCreate?: number;
      skipped: number;
      errorCount: number;
      errors: Array<{ row: number; field: string; message: string }>;
      preview: unknown[];
    }>(`/companies/${encodeURIComponent(id)}/mdm/import`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  commodities: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/commodities${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createCommodity: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/commodities`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchCommodity: (id: string, commodityId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/commodities/${encodeURIComponent(commodityId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  warehouses: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/warehouses${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createWarehouse: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/warehouses`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchWarehouse: (id: string, warehouseId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/warehouses/${encodeURIComponent(warehouseId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  borderCrossings: (id: string) =>
    api<any[]>(`/companies/${encodeURIComponent(id)}/border-crossings`),
  portsOfEntry: (
    id: string,
    opts?: { selectableOnly?: boolean; country?: string },
  ) => {
    const q = new URLSearchParams();
    if (opts?.selectableOnly) q.set('selectableOnly', '1');
    if (opts?.country) q.set('country', opts.country);
    const qs = q.toString();
    return api<any[]>(
      `/companies/${encodeURIComponent(id)}/ports-of-entry${qs ? `?${qs}` : ''}`,
    );
  },
  portCustoms: (id: string, portId: string) =>
    api<any>(
      `/companies/${encodeURIComponent(id)}/ports-of-entry/${encodeURIComponent(portId)}/customs`,
    ),
  patchPortOfEntry: (id: string, portId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/ports-of-entry/${encodeURIComponent(portId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  maintenanceVendors: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/maintenance-vendors${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createMaintenanceVendor: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/maintenance-vendors`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchMaintenanceVendor: (id: string, rowId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/maintenance-vendors/${encodeURIComponent(rowId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  fuelStations: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/fuel-stations${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createFuelStation: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/fuel-stations`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchFuelStation: (id: string, rowId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/fuel-stations/${encodeURIComponent(rowId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  insuranceProviders: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/insurance-providers${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createInsuranceProvider: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/insurance-providers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchInsuranceProvider: (id: string, rowId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/insurance-providers/${encodeURIComponent(rowId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  costCenters: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/cost-centers${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createCostCenter: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/cost-centers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchCostCenter: (id: string, rowId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/cost-centers/${encodeURIComponent(rowId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  payrollCategories: (id: string, selectableOnly = false) =>
    api<any[]>(
      `/companies/${encodeURIComponent(id)}/payroll-categories${selectableOnly ? '?selectableOnly=1' : ''}`,
    ),
  createPayrollCategory: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/payroll-categories`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchPayrollCategory: (id: string, rowId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/payroll-categories/${encodeURIComponent(rowId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  referenceData: (
    id: string,
    opts?: { selectableOnly?: boolean; kind?: string },
  ) => {
    const q = new URLSearchParams();
    if (opts?.selectableOnly) q.set('selectableOnly', '1');
    if (opts?.kind) q.set('kind', opts.kind);
    const qs = q.toString();
    return api<any[]>(
      `/companies/${encodeURIComponent(id)}/reference-data${qs ? `?${qs}` : ''}`,
    );
  },
  createReferenceData: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/reference-data`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchReferenceData: (id: string, rowId: string, body: unknown) =>
    api(
      `/companies/${encodeURIComponent(id)}/reference-data/${encodeURIComponent(rowId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  departments: (id: string) =>
    api<any[]>(`/companies/${encodeURIComponent(id)}/departments`),
  saveDepartment: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/departments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  documents: (id: string) =>
    api<any[]>(`/companies/${encodeURIComponent(id)}/documents`),
  createDocument: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/documents`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteDocument: (id: string, docId: string) =>
    api(
      `/companies/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`,
      { method: 'DELETE' },
    ),
  apiKeys: (id: string) =>
    api<any[]>(`/companies/${encodeURIComponent(id)}/api-keys`),
  createApiKey: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokeApiKey: (id: string, keyId: string) =>
    api(
      `/companies/${encodeURIComponent(id)}/api-keys/${encodeURIComponent(keyId)}/revoke`,
      { method: 'POST' },
    ),
  securityPolicy: (id: string) =>
    api<any>(`/companies/${encodeURIComponent(id)}/security-policy`),
  patchSecurityPolicy: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/security-policy`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  notificationRules: (id: string) =>
    api<any[]>(`/companies/${encodeURIComponent(id)}/notification-rules`),
  saveNotificationRule: (id: string, body: unknown) =>
    api(`/companies/${encodeURIComponent(id)}/notification-rules`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listCustomRoles: (id: string) =>
    api<CustomRoleDto[]>(
      `/companies/${encodeURIComponent(id)}/custom-roles`,
    ),
  getCustomRole: (id: string, roleId: string) =>
    api<CustomRoleDto>(
      `/companies/${encodeURIComponent(id)}/custom-roles/${encodeURIComponent(roleId)}`,
    ),
  createCustomRole: (
    id: string,
    body: {
      name: string;
      description?: string;
      baseRole: string;
      permissions: string[];
    },
  ) =>
    api<CustomRoleDto>(`/companies/${encodeURIComponent(id)}/custom-roles`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCustomRole: (
    id: string,
    roleId: string,
    body: {
      name?: string;
      description?: string;
      permissions?: string[];
    },
  ) =>
    api<CustomRoleDto>(
      `/companies/${encodeURIComponent(id)}/custom-roles/${encodeURIComponent(roleId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteCustomRole: (id: string, roleId: string) =>
    api<{ ok: boolean }>(
      `/companies/${encodeURIComponent(id)}/custom-roles/${encodeURIComponent(roleId)}`,
      { method: 'DELETE' },
    ),
};

export const plansApi = {
  list: () => api<any[]>('/plans'),
  get: (code: string) => api<any>(`/plans/${encodeURIComponent(code)}`),
};

export const tenantsApi = {
  list: () => api<any[]>('/tenants'),
  get: (companyId: string) =>
    api<any>(`/tenants/${encodeURIComponent(companyId)}`),
  provision: (companyId: string, force = false) =>
    api(`/tenants/${encodeURIComponent(companyId)}/provision`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
  deprovision: (companyId: string, dropDatabase = false) =>
    api(
      `/tenants/${encodeURIComponent(companyId)}/deprovision${
        dropDatabase ? '?dropDatabase=true' : ''
      }`,
      { method: 'POST' },
    ),
  provisionPending: () =>
    api('/tenants/provision-pending', { method: 'POST' }),
  schemaMigrateAll: () =>
    api<{ migrated: number; ok: number; results: unknown[] }>(
      '/tenants/schema-migrate-all',
      { method: 'POST' },
    ),
  opsSummary: () => api<any>('/tenants/ops/summary'),
};

export const driversApi = {
  list: (companyId: string) =>
    api<any[]>(`/drivers?companyId=${encodeURIComponent(companyId)}`),
  get: (id: string) => api<any>(`/drivers/${id}`),
  create: (body: unknown) =>
    api('/drivers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/drivers/${id}`, { method: 'DELETE' }),
  dispatchReady: (id: string) =>
    api<{
      ready: boolean;
      missing: string[];
      lifecycleOk?: boolean;
      lifecycleStatus?: string;
    }>(`/drivers/${id}/dispatch-ready`),
  approve: (id: string) =>
    api(`/drivers/${id}/approve`, { method: 'POST', body: '{}' }),
  suspend: (id: string, reason?: string) =>
    api(`/drivers/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  terminate: (id: string, reason?: string) =>
    api(`/drivers/${id}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  archive: (id: string) =>
    api(`/drivers/${id}/archive`, { method: 'POST', body: '{}' }),
  qualifications: (driverId: string) =>
    api<any[]>(`/drivers/${encodeURIComponent(driverId)}/qualifications`),
  createQualification: (driverId: string, body: unknown) =>
    api(`/drivers/${encodeURIComponent(driverId)}/qualifications`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateQualification: (id: string, body: unknown) =>
    api(`/qualifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  removeQualification: (id: string) =>
    api(`/qualifications/${id}`, { method: 'DELETE' }),
  borderEligible: (id: string) =>
    api<{
      eligible: boolean;
      missing: string[];
      warnings: string[];
    }>(`/drivers/${id}/border-eligible`),
  performance: (id: string) =>
    api<{
      totalMiles: number;
      deliveriesCompleted: number;
      onTimePct: number | null;
      revenue: number;
      inTransit: number;
      totalLoads: number;
    }>(`/drivers/${id}/performance`),
  equipmentAssignments: (driverId: string) =>
    api<any[]>(
      `/drivers/${encodeURIComponent(driverId)}/equipment-assignments`,
    ),
  assignEquipment: (driverId: string, body: unknown) =>
    api(`/drivers/${encodeURIComponent(driverId)}/equipment-assignments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  unassignEquipment: (assignmentId: string) =>
    api(`/equipment-assignments/${assignmentId}/unassign`, {
      method: 'PATCH',
      body: '{}',
    }),
  safetyEvents: (driverId: string) =>
    api<any[]>(`/drivers/${encodeURIComponent(driverId)}/safety-events`),
  createSafetyEvent: (driverId: string, body: unknown) =>
    api(`/drivers/${encodeURIComponent(driverId)}/safety-events`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSafetyEvent: (id: string, body: unknown) =>
    api(`/safety-events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  removeSafetyEvent: (id: string) =>
    api(`/safety-events/${id}`, { method: 'DELETE' }),
  trainingRecords: (driverId: string) =>
    api<any[]>(`/drivers/${encodeURIComponent(driverId)}/training-records`),
  createTrainingRecord: (driverId: string, body: unknown) =>
    api(`/drivers/${encodeURIComponent(driverId)}/training-records`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTrainingRecord: (id: string, body: unknown) =>
    api(`/training-records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  removeTrainingRecord: (id: string) =>
    api(`/training-records/${id}`, { method: 'DELETE' }),
};

export const documentsApi = {
  list: (params: { driverId?: string; companyId?: string }) => {
    const q = new URLSearchParams();
    if (params.driverId) q.set('driverId', params.driverId);
    if (params.companyId) q.set('companyId', params.companyId);
    return api<any[]>(`/documents?${q}`);
  },
  upsert: (body: unknown) =>
    api('/documents', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }),
};

export const contractsApi = {
  list: (driverId: string) =>
    api<any[]>(`/contracts?driverId=${encodeURIComponent(driverId)}`),
  upsert: (body: unknown) =>
    api('/contracts', { method: 'POST', body: JSON.stringify(body) }),
  sign: (id: string, body: unknown) =>
    api(`/contracts/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const invitesApi = {
  list: (companyId: string) =>
    api<any[]>(`/invites?companyId=${encodeURIComponent(companyId)}`),
  create: (
    companyId: string,
    extra?: {
      kind?: 'driver' | 'staff';
      role?: string;
      email?: string;
      name?: string;
    },
  ) =>
    api<any>('/invites', {
      method: 'POST',
      body: JSON.stringify({ companyId, ...extra }),
    }),
  byToken: (token: string) => api<any>(`/invites/by-token/${token}`),
  complete: (token: string, body: unknown) =>
    api<any>(`/invites/${token}/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revoke: (id: string) =>
    api<any>(`/invites/${id}/revoke`, { method: 'POST', body: '{}' }),
  regenerate: (id: string) =>
    api<any>(`/invites/${id}/regenerate`, { method: 'POST', body: '{}' }),
};

export const assetsApi = {
  list: (companyId: string, type?: string) => {
    const q = new URLSearchParams({ companyId });
    if (type) q.set('type', type);
    return api<any[]>(`/assets?${q}`);
  },
  equipmentTypes: (companyId: string) =>
    api<Array<{ id: string; code: string; name: string; system: boolean }>>(
      `/assets/equipment-types?companyId=${encodeURIComponent(companyId)}`,
    ),
  create: (body: unknown) =>
    api('/assets', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleActive: (id: string) =>
    api(`/assets/${id}/toggle-active`, { method: 'PATCH' }),
  setStatus: (id: string, status: string) =>
    api(`/assets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  remove: (id: string) => api(`/assets/${id}`, { method: 'DELETE' }),
};

export const loadsApi = {
  list: (params: {
    companyId: string;
    status?: string;
    driverId?: string;
  }) => {
    const q = new URLSearchParams({ companyId: params.companyId });
    if (params.status) q.set('status', params.status);
    if (params.driverId) q.set('driverId', params.driverId);
    return api<any[]>(`/loads?${q}`);
  },
  active: (companyId: string) =>
    api<any[]>(`/loads/active?companyId=${encodeURIComponent(companyId)}`),
  create: (body: unknown) =>
    api('/loads', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/loads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setStatus: (id: string, status: string) =>
    api(`/loads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  simulateTrack: (id: string) =>
    api(`/loads/${id}/simulate-track`, { method: 'POST' }),
  remove: (id: string) => api(`/loads/${id}`, { method: 'DELETE' }),
};

export const manifestsApi = {
  list: (companyId: string) =>
    api<any[]>(`/manifests?companyId=${encodeURIComponent(companyId)}`),
  create: (body: unknown) =>
    api('/manifests', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/manifests/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/manifests/${id}`, { method: 'DELETE' }),
  submit: (id: string) => api(`/manifests/${id}/submit`, { method: 'POST' }),
  accept: (id: string) => api(`/manifests/${id}/accept`, { method: 'POST' }),
  reject: (id: string, reason?: string) =>
    api(`/manifests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  cancel: (id: string) => api(`/manifests/${id}/cancel`, { method: 'POST' }),
};

export const carrierProfilesApi = {
  get: (companyId: string) =>
    api<any>(`/carrier-profiles/${encodeURIComponent(companyId)}`),
  upsert: (companyId: string, body: unknown) =>
    api(`/carrier-profiles/${encodeURIComponent(companyId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const tripSheetsApi = {
  list: (params: { companyId: string; driverId?: string }) => {
    const q = new URLSearchParams({ companyId: params.companyId });
    if (params.driverId) q.set('driverId', params.driverId);
    return api<any[]>(`/trip-sheets?${q}`);
  },
  create: (body: unknown) =>
    api('/trip-sheets', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/trip-sheets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/trip-sheets/${id}`, { method: 'DELETE' }),
};

export const settlementsApi = {
  list: (params: { companyId: string; driverId?: string; status?: string }) => {
    const q = new URLSearchParams({ companyId: params.companyId });
    if (params.driverId) q.set('driverId', params.driverId);
    if (params.status) q.set('status', params.status);
    return api<any[]>(`/settlements?${q}`);
  },
  create: (body: unknown) =>
    api('/settlements', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/settlements/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  approve: (id: string) =>
    api(`/settlements/${id}/approve`, { method: 'POST' }),
  pay: (id: string) => api(`/settlements/${id}/pay`, { method: 'POST' }),
  remove: (id: string) => api(`/settlements/${id}`, { method: 'DELETE' }),
};

export const reportsApi = {
  summary: (companyId: string) =>
    api<any>(`/reports/summary?companyId=${encodeURIComponent(companyId)}`),
  analytics: (companyId: string) =>
    api<any>(`/reports/analytics?companyId=${encodeURIComponent(companyId)}`),
};

export const maintenanceApi = {
  list: (companyId: string, assetId?: string) => {
    const q = new URLSearchParams({ companyId });
    if (assetId) q.set('assetId', assetId);
    return api<any[]>(`/maintenance?${q}`);
  },
  create: (body: unknown) =>
    api('/maintenance', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/maintenance/${id}`, { method: 'DELETE' }),
};

export const dvirApi = {
  list: (companyId: string, assetId?: string) => {
    const q = new URLSearchParams({ companyId });
    if (assetId) q.set('assetId', assetId);
    return api<any[]>(`/dvir?${q}`);
  },
  create: (body: unknown) =>
    api('/dvir', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/dvir/${id}`, { method: 'DELETE' }),
};

export const invoicesApi = {
  list: (companyId: string, status?: string) => {
    const q = new URLSearchParams({ companyId });
    if (status) q.set('status', status);
    return api<any[]>(`/invoices?${q}`);
  },
  create: (body: unknown) =>
    api('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/invoices/${id}`, { method: 'DELETE' }),
};

export const billsApi = {
  list: (companyId: string) =>
    api<any[]>(`/bills?companyId=${encodeURIComponent(companyId)}`),
  create: (body: unknown) =>
    api('/bills', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/bills/${id}`, { method: 'DELETE' }),
};

export const paymentsApi = {
  list: (companyId: string) =>
    api<any[]>(`/payments?companyId=${encodeURIComponent(companyId)}`),
  create: (body: unknown) =>
    api('/payments', { method: 'POST', body: JSON.stringify(body) }),
};

export const accountsApi = {
  list: (companyId: string) =>
    api<any[]>(`/accounts?companyId=${encodeURIComponent(companyId)}`),
  seedDefaults: (companyId: string) =>
    api('/accounts/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    }),
};

export const messagesApi = {
  list: (companyId: string, toUserId?: string) => {
    const q = new URLSearchParams({ companyId });
    if (toUserId) q.set('toUserId', toUserId);
    return api<any[]>(`/messages?${q}`);
  },
  create: (body: unknown) =>
    api('/messages', { method: 'POST', body: JSON.stringify(body) }),
  markRead: (id: string) =>
    api(`/messages/${id}/read`, { method: 'PATCH' }),
};

export const commentsApi = {
  list: (companyId: string, entityType: string, entityId: string) => {
    const q = new URLSearchParams({ companyId, entityType, entityId });
    return api<any[]>(`/comments?${q}`);
  },
  create: (body: unknown) =>
    api('/comments', { method: 'POST', body: JSON.stringify(body) }),
};

export const auditApi = {
  list: (companyId: string, limit = 100) =>
    api<any[]>(
      `/audit?companyId=${encodeURIComponent(companyId)}&limit=${limit}`,
    ),
  create: (body: unknown) =>
    api('/audit', { method: 'POST', body: JSON.stringify(body) }),
};

export const notificationsApi = {
  list: (companyId: string, limit = 50) =>
    api<any[]>(
      `/notifications?companyId=${encodeURIComponent(companyId)}&limit=${limit}`,
    ),
  sendSms: (body: {
    to: string;
    body: string;
    companyId?: string;
    meta?: Record<string, unknown>;
  }) =>
    api('/notifications/sms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export function setTokens(access: string | null, refresh?: string | null) {
  if (access) localStorage.setItem('ts_token', access);
  else localStorage.removeItem('ts_token');
  if (refresh) localStorage.setItem('ts_refresh', refresh);
  else if (refresh === null) localStorage.removeItem('ts_refresh');
}

export function clearTokens() {
  localStorage.removeItem('ts_token');
  localStorage.removeItem('ts_refresh');
}

/** @deprecated prefer setTokens */
export function setToken(token: string | null) {
  if (token) localStorage.setItem('ts_token', token);
  else {
    localStorage.removeItem('ts_token');
    localStorage.removeItem('ts_refresh');
  }
}

export function getToken() {
  return localStorage.getItem('ts_token');
}

export function getRefreshToken() {
  return localStorage.getItem('ts_refresh');
}

export { BASE as API_BASE };
