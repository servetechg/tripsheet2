import { ForbiddenException } from '@nestjs/common';
import { getTenantStore } from './context';

export function parsePermissionsHeader(
  raw: string | undefined | null,
): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasPermission(
  permissions: string[] | undefined | null,
  code: string,
): boolean {
  return Boolean(code && permissions?.includes(code));
}

export function isPrivilegedRole(role: string | undefined | null): boolean {
  return (
    role === 'superadmin' ||
    role === 'company_owner' ||
    role === 'company_admin'
  );
}

export function actorHasPermission(code: string): boolean {
  const store = getTenantStore();
  if (!store) return false;
  if (isPrivilegedRole(store.role)) return true;
  return hasPermission(store.permissions, code);
}

export function assertPermission(code: string): void {
  if (actorHasPermission(code)) return;
  throw new ForbiddenException(`Missing permission: ${code}`);
}
