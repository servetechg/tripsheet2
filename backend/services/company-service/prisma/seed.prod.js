const { PrismaClient } = require('@prisma/client');

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
];

async function main() {
  const prisma = new PrismaClient();
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
  console.log('Seeded platform plans (no demo companies)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
