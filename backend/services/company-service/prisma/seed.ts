import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.company.upsert({
    where: { id: 'c1' },
    update: {
      name: 'MKX Transport',
      shortName: 'MKX',
      tagline: 'MORE EFFICIENT',
      address: '9 Red Sky Rd NE, Calgary, AB T3N 1P8',
      active: true,
    },
    create: {
      id: 'c1',
      name: 'MKX Transport',
      shortName: 'MKX',
      tagline: 'MORE EFFICIENT',
      address: '9 Red Sky Rd NE, Calgary, AB T3N 1P8',
      active: true,
    },
  });
  console.log('Seeded company: MKX Transport (c1)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
