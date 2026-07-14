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

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: AuthUserDto }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<AuthUserDto>('/auth/me'),
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
  create: (companyId: string) =>
    api<any>('/invites', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
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

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ts_token', token);
  else localStorage.removeItem('ts_token');
}

export function getToken() {
  return localStorage.getItem('ts_token');
}

export { BASE as API_BASE };
