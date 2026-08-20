/**
 * Phase 4: ETL all active tenants, then cut over verified ones.
 *
 *   npx ts-node --transpile-only scripts/migrate-all-tenants.ts
 *   npx ts-node --transpile-only scripts/migrate-all-tenants.ts --cutover
 *   npx ts-node --transpile-only scripts/migrate-all-tenants.ts --archive
 *   npx ts-node --transpile-only scripts/migrate-all-tenants.ts <companyId>
 *   npx ts-node --transpile-only scripts/migrate-all-tenants.ts <companyId> --skip-sync --cutover
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EtlService } from '../src/tenants/etl.service';

async function main() {
  const args = process.argv.slice(2);
  const doCutover = args.includes('--cutover');
  const doArchive = args.includes('--archive');
  const skipSync = args.includes('--skip-sync');
  const companyId = args.find((a) => !a.startsWith('--'));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const etl = app.get(EtlService);
  try {
    if (companyId) {
      console.log(`Migrating ${companyId} (skipSync=${skipSync})...`);
      const migrated = await etl.migrateCompany(companyId, {
        actorName: 'cli',
        skipSync,
      });
      console.log(JSON.stringify(migrated, null, 2));
      if (doCutover) {
        const cut = await etl.cutoverCompany(companyId, { actorName: 'cli' });
        console.log(JSON.stringify(cut, null, 2));
      }
      if (doArchive) {
        const arch = await etl.archiveSharedData(companyId, {
          actorName: 'cli',
        });
        console.log(JSON.stringify(arch, null, 2));
      }
      return;
    }

    console.log('Migrating all active tenants...');
    // migrateAll always syncs; call per-tenant if --skip-sync needed
    if (skipSync) {
      throw new Error('--skip-sync requires a <companyId>');
    }
    const migrated = await etl.migrateAll('cli');
    console.log(JSON.stringify(migrated, null, 2));

    if (doCutover) {
      console.log('Cutting over verified tenants...');
      const cut = await etl.cutoverAllVerified('cli');
      console.log(JSON.stringify(cut, null, 2));
    }

    if (doArchive) {
      console.log(
        'Archive requires per-company confirmation; use --archive with <companyId>',
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
