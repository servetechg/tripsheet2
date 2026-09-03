const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { syncRbacCatalog } = require('../dist/rbac/rbac.sync');

async function main() {
  const prisma = new PrismaClient();
  await syncRbacCatalog(prisma);
  console.log('RBAC catalog synced');

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@tripsheet.io' },
    update: {
      passwordHash,
      name: 'Super Admin',
      role: 'superadmin',
      companyId: null,
    },
    create: {
      id: 'u1',
      email: 'admin@tripsheet.io',
      passwordHash,
      name: 'Super Admin',
      role: 'superadmin',
      companyId: null,
    },
  });
  console.log('Seeded user: admin@tripsheet.io (superadmin)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
