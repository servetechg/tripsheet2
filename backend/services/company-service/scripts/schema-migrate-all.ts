/**
 * CLI: Phase 6 schema migrate-all (org SQL + optional Prisma push).
 *   npx ts-node --transpile-only scripts/schema-migrate-all.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TenantOpsService } from '../src/tenants/tenant-ops.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const ops = app.get(TenantOpsService);
    const result = await ops.schemaMigrateAll('cli');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
