import { PrismaClient } from '@prisma/client';

/**
 * Seeds assets for company c1 matching frontend/src/data/seed.ts unit numbers.
 * Load seed is skipped: driverId must come from driver-service after that seed
 * (email-based lookup later). Create L001 via API once a real driverId exists.
 */
const prisma = new PrismaClient();

const assets = [
  {
    id: 'a1',
    companyId: 'c1',
    type: 'truck',
    unitNo: '32054',
    year: '2022',
    make: 'Kenworth',
    model: 'T680',
    vin: '1XKWDB0X0NJ123456',
    plate: 'AB-32054',
    status: 'active',
  },
  {
    id: 'a2',
    companyId: 'c1',
    type: 'truck',
    unitNo: '32055',
    year: '2021',
    make: 'Peterbilt',
    model: '579',
    vin: '1XPWDB9X0ND654321',
    plate: 'AB-32055',
    status: 'active',
  },
  {
    id: 'a3',
    companyId: 'c1',
    type: 'trailer',
    unitNo: 'DV1767',
    year: '2020',
    make: 'Stoughton',
    model: '53ft Dry Van',
    vin: '1DW1A5324LA000001',
    plate: 'AB-DV1767',
    status: 'active',
  },
  {
    id: 'a4',
    companyId: 'c1',
    type: 'trailer',
    unitNo: 'MKX002',
    year: '2019',
    make: 'Wabash',
    model: '53ft Reefer',
    vin: '1JJV532B8KL000002',
    plate: 'AB-MKX002',
    status: 'active',
  },
];

async function main() {
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { companyId_unitNo: { companyId: asset.companyId, unitNo: asset.unitNo } },
      update: {
        type: asset.type,
        year: asset.year,
        make: asset.make,
        model: asset.model,
        vin: asset.vin,
        plate: asset.plate,
        status: asset.status,
      },
      create: asset,
    });
  }

  console.log(`Seeded ${assets.length} assets for company c1 (load seed skipped — await driver-service)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
