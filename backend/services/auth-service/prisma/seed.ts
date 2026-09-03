import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { syncRbacCatalog } from '../src/rbac/rbac.sync';

const prisma = new PrismaClient();

async function main() {
  await syncRbacCatalog(prisma);
  console.log('RBAC catalog synced');

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@tripsheet.io' },
    update: {
      passwordHash,
      name: 'Super Admin',
      role: Role.superadmin,
      companyId: null,
    },
    create: {
      id: 'u1',
      email: 'admin@tripsheet.io',
      passwordHash,
      name: 'Super Admin',
      role: Role.superadmin,
      companyId: null,
    },
  });
  console.log('Seeded user: admin@tripsheet.io (superadmin)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
