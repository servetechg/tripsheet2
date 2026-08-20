import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLANS = [
  {
    id: 'plan_starter',
    code: 'starter',
    name: 'Starter',
    description: 'Up to 10 drivers; basic dispatch & fleet',
    maxDrivers: 10,
    features: {
      driverOnboarding: true,
      dispatch: true,
      fleetMaintenance: true,
      payroll: false,
      ocr: false,
      accounting: false,
      reports: true,
      apiAccess: false,
      customs: false,
    },
  },
  {
    id: 'plan_professional',
    code: 'professional',
    name: 'Professional',
    description: 'Unlimited drivers; OCR, payroll, accounting, reports',
    maxDrivers: -1,
    features: {
      driverOnboarding: true,
      dispatch: true,
      fleetMaintenance: true,
      payroll: true,
      ocr: true,
      accounting: true,
      reports: true,
      apiAccess: false,
      customs: true,
    },
  },
  {
    id: 'plan_enterprise',
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited; API, multi-terminal, SSO-ready, white-label',
    maxDrivers: -1,
    features: {
      driverOnboarding: true,
      dispatch: true,
      fleetMaintenance: true,
      payroll: true,
      ocr: true,
      accounting: true,
      reports: true,
      apiAccess: true,
      customs: true,
      sso: true,
      whiteLabel: true,
      multiTerminal: true,
    },
  },
] as const;

async function main() {
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        maxDrivers: p.maxDrivers,
        features: p.features,
        active: true,
      },
      create: { ...p, active: true },
    });
  }

  const starter = await prisma.plan.findUniqueOrThrow({
    where: { code: 'starter' },
  });

  await prisma.company.upsert({
    where: { id: 'c1' },
    update: {
      name: 'MKX Transport',
      shortName: 'MKX',
      slug: 'mkx',
      tagline: 'MORE EFFICIENT',
      address: '9 Red Sky Rd NE, Calgary, AB T3N 1P8',
      active: true,
      status: 'active',
      planId: starter.id,
    },
    create: {
      id: 'c1',
      name: 'MKX Transport',
      shortName: 'MKX',
      slug: 'mkx',
      tagline: 'MORE EFFICIENT',
      address: '9 Red Sky Rd NE, Calgary, AB T3N 1P8',
      active: true,
      status: 'active',
      planId: starter.id,
    },
  });

  await prisma.subscription.upsert({
    where: { companyId: 'c1' },
    update: { planId: starter.id, status: 'active' },
    create: {
      companyId: 'c1',
      planId: starter.id,
      status: 'active',
    },
  });

  await prisma.tenantDatabase.upsert({
    where: { companyId: 'c1' },
    update: {
      dbName: 'fq_tenant_mkx',
      status: 'pending_provision',
    },
    create: {
      companyId: 'c1',
      dbName: 'fq_tenant_mkx',
      host: 'localhost',
      port: 5432,
      status: 'pending_provision',
      schemaVersion: '1',
    },
  });

  console.log('Seeded platform plans + company MKX (c1) with pending tenant DB');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
