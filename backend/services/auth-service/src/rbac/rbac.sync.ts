import type { PrismaClient } from '@prisma/client';
import { PERMISSIONS, SYSTEM_ROLES } from './rbac.catalog';

export async function syncRbacCatalog(prisma: PrismaClient) {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        module: p.module,
        name: p.name,
        description: p.description || '',
      },
      update: {
        module: p.module,
        name: p.name,
        description: p.description || '',
      },
    });
  }

  for (const role of SYSTEM_ROLES) {
    await prisma.systemRole.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        system: true,
      },
      update: {
        name: role.name,
        description: role.description,
        system: true,
      },
    });
    await prisma.rolePermission.deleteMany({ where: { roleCode: role.code } });
    if (role.permissions.length) {
      await prisma.rolePermission.createMany({
        data: role.permissions.map((permissionCode) => ({
          roleCode: role.code,
          permissionCode,
        })),
        skipDuplicates: true,
      });
    }
  }
}
