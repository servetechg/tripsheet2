import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const users: Array<{
    id: string;
    email: string;
    password: string;
    name: string;
    role: Role;
    companyId: string | null;
  }> = [
    {
      id: 'u1',
      email: 'admin@tripsheet.io',
      password: 'admin123',
      name: 'Super Admin',
      role: 'superadmin',
      companyId: null,
    },
    {
      id: 'u2',
      email: 'admin@mkx.ca',
      password: 'mkx123',
      name: 'MKX Admin',
      role: 'company_admin',
      companyId: 'c1',
    },
    {
      id: 'u3',
      email: 'divyam@mkx.ca',
      password: 'driver123',
      name: 'Divyam Chopra',
      role: 'driver',
      companyId: 'c1',
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        name: u.name,
        role: u.role,
        companyId: u.companyId,
      },
      create: {
        id: u.id,
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        companyId: u.companyId,
      },
    });
    console.log(`Seeded user: ${u.email} (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
