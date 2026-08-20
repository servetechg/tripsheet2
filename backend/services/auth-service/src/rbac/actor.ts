import { ForbiddenException } from '@nestjs/common';
import { normalizeRoleCode } from './rbac.catalog';

export type JwtActor = {
  sub?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  companyId?: string | null;
};

export function isPrivilegedActor(role: string | undefined) {
  const r = normalizeRoleCode(role);
  return r === 'superadmin' || r === 'company_owner';
}

export function actorHas(actor: JwtActor | undefined, code: string): boolean {
  if (!actor) return false;
  if (isPrivilegedActor(actor.role)) return true;
  return Boolean(actor.permissions?.includes(code));
}

export function assertActorHas(actor: JwtActor | undefined, code: string) {
  if (actorHas(actor, code)) return;
  throw new ForbiddenException(`Missing permission: ${code}`);
}
