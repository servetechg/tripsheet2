/**
 * Sync full Prisma schemas into tenant DB domain schemas.
 *
 *   npx ts-node --transpile-only scripts/sync-tenant-schemas.ts
 *   npx ts-node --transpile-only scripts/sync-tenant-schemas.ts fq_tenant_mkx
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { decryptSecret } from '../src/platform/crypto.util';
import { syncTenantOpsSchemas } from '../src/tenants/schema-sync.util';

async function main() {
  const only = process.argv[2];
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  try {
    const rows = await prisma.tenantDatabase.findMany({
      where: {
        status: 'active',
        ...(only ? { dbName: only } : {}),
      },
    });
    if (!rows.length) {
      console.log('No active tenants to sync');
      return;
    }
    for (const row of rows) {
      if (!row.connectionCiphertext) {
        console.warn(`Skip ${row.dbName}: no connection`);
        continue;
      }
      const url = decryptSecret(row.connectionCiphertext);
      console.log(`Syncing ${row.dbName}...`);
      await syncTenantOpsSchemas(url);
      await prisma.tenantDatabase.update({
        where: { id: row.id },
        data: { schemaVersion: '3' },
      });
      console.log(`Done ${row.dbName}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
