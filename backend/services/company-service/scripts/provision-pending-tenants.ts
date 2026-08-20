/**
 * Backfill: provision all pending/failed tenant databases.
 *
 * Usage (from company-service dir, with .env loaded):
 *   npx ts-node --transpile-only scripts/provision-pending-tenants.ts
 *
 * Or via API after company-service is running:
 *   POST /api/tenants/provision-pending
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ProvisioningService } from '../src/tenants/provisioning.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const provisioning = app.get(ProvisioningService);
    const result = await provisioning.provisionAllPending('cli');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
