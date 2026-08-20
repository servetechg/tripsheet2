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

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    const text = await res.text().catch(() => res.statusText);
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (res.status === 401) {
      localStorage.removeItem('ts_token');
      window.dispatchEvent(new Event('ts:auth-expired'));
    }
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : text || res.statusText;
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

export type SessionDto = {
  sessionDays: number;
  idleTimeoutMinutes: number;
  passwordPolicy?: { minLength: number; complexity: boolean; hint: string };
  mfaRequired: boolean;
  mfaFlag: boolean;
};

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  tenantKey?: string | null;
  permissions?: string[];
  customRoleId?: string | null;
  customRoleName?: string | null;
  session?: SessionDto;
  createdAt?: string;
  updatedAt?: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: AuthUserDto; session?: SessionDto }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    ),
  me: () => api<AuthUserDto>('/auth/me'),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<{ accessToken: string; user: AuthUserDto; session?: SessionDto }>(
      '/auth/change-password',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  logoutAll: () => api<{ ok: boolean }>('/auth/logout-all', { method: 'POST' }),
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
  setRoutingMode: (companyId: string, routingMode: 'shared' | 'tenant') =>
    api(`/tenants/${encodeURIComponent(companyId)}/routing-mode`, {
      method: 'PATCH',
      body: JSON.stringify({ routingMode }),
    }),
  migrate: (companyId: string) =>
    api(`/tenants/${encodeURIComponent(companyId)}/migrate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  verify: (companyId: string) =>
    api(`/tenants/${encodeURIComponent(companyId)}/verify`, {
      method: 'POST',
    }),
  cutover: (companyId: string, force = false) =>
    api(`/tenants/${encodeURIComponent(companyId)}/cutover`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
  archiveShared: (companyId: string) =>
    api(`/tenants/${encodeURIComponent(companyId)}/archive-shared`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  migrateAll: () =>
    api('/tenants/migrate-all', { method: 'POST' }),
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
    api<{ ready: boolean; missing: string[] }>(`/drivers/${id}/dispatch-ready`),
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
};

export const assetsApi = {
  list: (companyId: string, type?: string) => {
    const q = new URLSearchParams({ companyId });
    if (type) q.set('type', type);
    return api<any[]>(`/assets?${q}`);
  },
  create: (body: unknown) =>
    api('/assets', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleActive: (id: string) =>
    api(`/assets/${id}/toggle-active`, { method: 'PATCH' }),
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

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ts_token', token);
  else localStorage.removeItem('ts_token');
}

export function getToken() {
  return localStorage.getItem('ts_token');
}

export { BASE as API_BASE };
