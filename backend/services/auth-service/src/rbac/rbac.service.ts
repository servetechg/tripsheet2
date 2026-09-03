import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_PERMISSION_CODES,
  PERMISSIONS,
  SYSTEM_ROLES,
  normalizeRoleCode,
} from './rbac.catalog';
import { syncRbacCatalog } from './rbac.sync';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  syncCatalog() {
    return syncRbacCatalog(this.prisma);
  }

  async permissionsForRole(role: string): Promise<string[]> {
    const code = normalizeRoleCode(role);
    if (!code || code === 'superadmin') return [];

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleCode: code },
      select: { permissionCode: true },
    });
    if (rows.length) return rows.map((r) => r.permissionCode);

    if (code === 'company_owner') return [...ALL_PERMISSION_CODES];
    return [];
  }

  async listRoles() {
    const rows = await this.prisma.systemRole.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { permissions: true } },
        permissions: { select: { permissionCode: true } },
      },
    });
    if (rows.length) {
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
        system: r.system,
        permissionCount: r._count.permissions,
        permissions: r.permissions.map((p) => p.permissionCode),
      }));
    }
    return SYSTEM_ROLES.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      system: true,
      permissionCount: r.permissions.length,
      permissions: [...r.permissions],
    }));
  }

  async listPermissions() {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    if (rows.length) return rows;
    return PERMISSIONS.map((p) => ({
      code: p.code,
      module: p.module,
      name: p.name,
      description: p.description || '',
    }));
  }

  catalog() {
    return { permissions: PERMISSIONS, roles: SYSTEM_ROLES };
  }

  isCompanyOwnerRole(role: Role | string) {
    return normalizeRoleCode(String(role)) === 'company_owner';
  }
}
