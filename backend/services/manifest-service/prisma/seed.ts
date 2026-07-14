import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.carrierProfile.upsert({
    where: { companyId: 'c1' },
    update: {
      cbsaCarrierCode: 'MKX1',
      scacCode: 'MKXT',
      dotNumber: '12345678',
      csnNumber: '',
      fastLane: false,
    },
    create: {
      companyId: 'c1',
      cbsaCarrierCode: 'MKX1',
      scacCode: 'MKXT',
      dotNumber: '12345678',
      csnNumber: '',
      fastLane: false,
    },
  });
  console.log('Seeded carrier profile: MKX for company c1');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
