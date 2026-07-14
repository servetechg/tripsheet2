import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'divyam@mkx.ca';
  const companyId = 'c1';

  const driver = await prisma.driver.upsert({
    where: {
      companyId_email: { companyId, email },
    },
    update: {
      name: 'Divyam Chopra',
      userId: 'u3',
      phone: '+1 (403) 555-0100',
      licenseNo: 'AB-123456',
      citizenship: 'CA',
      active: true,
    },
    create: {
      companyId,
      userId: 'u3',
      name: 'Divyam Chopra',
      email,
      phone: '+1 (403) 555-0100',
      licenseNo: 'AB-123456',
      citizenship: 'CA',
      address: 'Calgary, AB',
      active: true,
    },
  });

  console.log(`Seeded driver: ${driver.email} (${driver.id}) company=${companyId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
