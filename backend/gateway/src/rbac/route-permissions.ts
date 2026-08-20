/**
 * Coarse RBAC: path + method → permission code.
 * Super Admin and Company Owner bypass in-tenant module gates (not platform routes).
 */

export type GateDecision =
  | { allow: true }
  | {
      allow: false;
      permission: string;
      message: string;
      auditDispatch?: boolean;
    };

const PUBLIC: RegExp[] = [
  /^\/health$/,
  /^\/api\/auth\/login$/,
  /^\/api\/invites\/by-token\//,
  /^\/api\/invites\/[^/]+\/complete$/,
];

function ownerRole(role: string) {
  return role === 'company_owner' || role === 'company_admin';
}

function mutating(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

/** Platform control-plane — Super Admin only */
export function isPlatformAdminPath(method: string, path: string): boolean {
  if (path.startsWith('/api/tenants')) return true;
  if (path.startsWith('/api/plans') && mutating(method)) return true;
  if (method === 'POST' && /^\/api\/companies$/.test(path)) return true;
  if (/\/toggle-active$/.test(path)) return true;
  return false;
}

function has(perms: string[] | undefined, code: string) {
  return Boolean(code && perms?.includes(code));
}

function hasAny(perms: string[] | undefined, codes: string[]) {
  return codes.some((c) => has(perms, c));
}

/**
 * First matching rule wins. `any` = authenticated tenant user.
 * `codes` = need at least one.
 */
function rule(
  method: string,
  path: string,
): { codes: string[] | 'any' | 'skip' } | null {
  const m = method.toUpperCase();
  const p = path.replace(/\/+$/, '') || '/';

  if (PUBLIC.some((re) => re.test(p))) return { codes: 'skip' };

  if (p === '/api/auth/me') return { codes: 'any' };
  if (p === '/api/auth/roles' || p === '/api/auth/permissions') {
    return { codes: ['users.view', 'users.assign_role', 'users.create'] };
  }
  if (p.startsWith('/api/auth/users')) {
    if (m === 'GET') return { codes: ['users.view'] };
    if (m === 'POST') return { codes: ['users.create'] };
    return { codes: ['users.edit', 'users.assign_role'] };
  }
  if (p.startsWith('/api/auth')) return { codes: 'any' };

  if (
    /^\/api\/companies\/[^/]+\/entitlements$/.test(p) ||
    /^\/api\/companies\/[^/]+\/(settings|branding|security)$/.test(p)
  ) {
    return { codes: 'any' };
  }
  if (p.startsWith('/api/companies')) {
    if (/\/custom-roles/.test(p)) {
      if (m === 'GET') return { codes: ['users.view', 'users.assign_role'] };
      return { codes: ['users.assign_role'] };
    }
    if (m === 'GET') return { codes: 'any' };
    if (/\/api-keys/.test(p)) return { codes: ['admin.api_keys'] };
    if (/\/security/.test(p) && mutating(m)) return { codes: ['admin.security'] };
    if (/\/locations|\/branches/.test(p)) return { codes: ['company.locations', 'company.edit'] };
    return { codes: ['company.edit'] };
  }

  if (p.startsWith('/api/plans')) {
    return { codes: m === 'GET' ? 'any' : ['company.billing.edit'] };
  }

  if (p.startsWith('/api/loads')) {
    if (m === 'GET') return { codes: ['dispatch.view'] };
    if (m === 'POST' && /\/simulate-track$/.test(p))
      return { codes: ['dispatch.edit', 'dispatch.view'] };
    if (m === 'POST') return { codes: ['dispatch.create'] };
    if (m === 'DELETE') return { codes: ['dispatch.delete'] };
    if (/\/status$/.test(p))
      return { codes: ['dispatch.edit', 'dispatch.close', 'dispatch.cancel'] };
    return { codes: ['dispatch.edit'] };
  }

  if (p.startsWith('/api/assets') || p.startsWith('/api/dvir')) {
    if (m === 'GET') return { codes: ['fleet.view'] };
    if (m === 'POST') return { codes: ['fleet.create', 'fleet.edit'] };
    if (m === 'DELETE') return { codes: ['fleet.delete'] };
    return { codes: ['fleet.edit'] };
  }

  if (p.startsWith('/api/maintenance')) {
    if (m === 'GET') return { codes: ['maintenance.view'] };
    return { codes: ['maintenance.schedule'] };
  }

  if (p.startsWith('/api/drivers')) {
    if (m === 'GET')
      return {
        codes: [
          'drivers.create',
          'drivers.edit',
          'drivers.docs.view',
          'dispatch.view',
          'users.view',
        ],
      };
    if (m === 'POST') return { codes: ['drivers.create'] };
    if (m === 'DELETE') return { codes: ['drivers.archive', 'drivers.suspend'] };
    return { codes: ['drivers.edit'] };
  }

  if (p.startsWith('/api/documents')) {
    if (m === 'GET') return { codes: ['drivers.docs.view'] };
    if (m === 'DELETE') return { codes: ['drivers.docs.delete'] };
    return { codes: ['drivers.docs.upload'] };
  }

  if (p.startsWith('/api/contracts')) {
    if (m === 'GET') return { codes: ['drivers.wage.view', 'payroll.view'] };
    if (m === 'POST' && /\/sign$/.test(p)) return { codes: ['payroll.view', 'drivers.wage.edit'] };
    return { codes: ['drivers.wage.edit'] };
  }

  if (p.startsWith('/api/invites')) {
    if (m === 'GET') return { codes: ['drivers.invite', 'users.create'] };
    return { codes: ['drivers.invite', 'users.create'] };
  }

  if (p.startsWith('/api/manifests') || p.startsWith('/api/carrier-profiles')) {
    if (m === 'GET') return { codes: ['dispatch.view', 'dispatch.docs'] };
    return { codes: ['dispatch.docs', 'dispatch.edit'] };
  }

  if (p.startsWith('/api/trip-sheets') || p.startsWith('/api/sheets')) {
    if (m === 'GET') return { codes: ['reports.view', 'dispatch.view'] };
    return { codes: ['dispatch.edit', 'reports.view'] };
  }

  if (
    p.startsWith('/api/invoices') ||
    p.startsWith('/api/bills') ||
    p.startsWith('/api/payments') ||
    p.startsWith('/api/accounts') ||
    p.startsWith('/api/settlements')
  ) {
    if (m === 'GET') return { codes: ['accounting.view', 'payroll.view'] };
    if (p.startsWith('/api/settlements')) {
      if (m === 'POST') return { codes: ['settlement.create'] };
      return { codes: ['settlement.edit'] };
    }
    if (p.startsWith('/api/invoices') && m === 'POST')
      return { codes: ['invoice.generate'] };
    return { codes: ['accounting.view'] };
  }

  if (p.startsWith('/api/reports')) {
    if (m === 'GET') return { codes: ['reports.view'] };
    return { codes: ['reports.export', 'reports.schedule'] };
  }

  if (p.startsWith('/api/audit')) {
    if (m === 'GET') return { codes: ['admin.audit'] };
    return { codes: ['admin.audit'] };
  }

  if (p.startsWith('/api/notifications') || p.startsWith('/api/messages') || p.startsWith('/api/comments')) {
    return { codes: 'any' };
  }

  // Unknown authenticated route: allow (health, future) — services still enforce
  return { codes: 'any' };
}

export function resolvePermissionGate(input: {
  method: string;
  path: string;
  role: string;
  permissions?: string[];
}): GateDecision {
  const method = (input.method || 'GET').toUpperCase();
  const path = (input.path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const role = input.role || '';

  const matched = rule(method, path);
  if (matched?.codes === 'skip') return { allow: true };

  if (isPlatformAdminPath(method, path) && role !== 'superadmin') {
    return {
      allow: false,
      permission: 'platform.admin',
      message: 'Platform administration requires Super Admin',
    };
  }

  if (role === 'superadmin') return { allow: true };
  if (ownerRole(role)) return { allow: true };

  if (!matched) return { allow: true };
  if (matched.codes === 'any') return { allow: true };

  const codes = matched.codes;
  if (hasAny(input.permissions, codes)) return { allow: true };

  const permission = codes[0];
  const auditDispatch =
    path.startsWith('/api/loads') && mutating(method);
  return {
    allow: false,
    permission,
    message: `Missing permission: ${permission}`,
    auditDispatch,
  };
}
