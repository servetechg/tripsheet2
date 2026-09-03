import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { ProvisioningService } from './provisioning.service';
import { EtlService } from './etl.service';
import { TenantOpsService } from './tenant-ops.service';
import { TenantLocalService } from '../org/tenant-local.service';

@Controller()
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly provisioning: ProvisioningService,
    private readonly etl: EtlService,
    private readonly ops: TenantOpsService,
    private readonly tenantLocal: TenantLocalService,
  ) {}

  @Get('tenants')
  list() {
    return this.tenants.listRegistry();
  }

  /** Phase 6: connections, disk, errors per tenant. */
  @Get('tenants/ops/summary')
  opsSummary() {
    return this.ops.getOpsSummary();
  }

  /** Backfill all pending/failed tenants — must be before :companyId routes. */
  @Post('tenants/provision-pending')
  provisionPending() {
    return this.provisioning.provisionAllPending('superadmin');
  }

  /**
   * Phase 6: apply org SQL (+ optional Prisma push) to all active tenants.
   * Safe for CI/CD after deploy — does not run ETL cutover.
   */
  @Post('tenants/schema-migrate-all')
  schemaMigrateAll() {
    return this.ops.schemaMigrateAll('superadmin');
  }

  /** Phase 4: ETL all active tenants (sync + copy + verify). */
  @Post('tenants/migrate-all')
  migrateAll() {
    return this.etl.migrateAll('superadmin');
  }

  /** Phase 4: cut over all verified tenants to routingMode=tenant. */
  @Post('tenants/cutover-all')
  cutoverAll() {
    return this.etl.cutoverAllVerified('superadmin');
  }

  @Get('tenants/:companyId')
  async one(@Param('companyId') companyId: string) {
    const conn = await this.tenants.getConnection(companyId);
    const { connectionUrl: _, ...safe } = conn;
    return { ...safe, hasConnection: Boolean(conn.connectionUrl) };
  }

  /** Provision or retry tenant DB (Phase 2). */
  @Post('tenants/:companyId/provision')
  provision(
    @Param('companyId') companyId: string,
    @Body() body?: { force?: boolean },
  ) {
    return this.provisioning.provisionCompany(companyId, {
      force: Boolean(body?.force),
      actorName: 'superadmin',
    });
  }

  /** Soft-suspend tenant DB (keep data). Optional dropDatabase=true destroys it. */
  @Post('tenants/:companyId/deprovision')
  deprovision(
    @Param('companyId') companyId: string,
    @Query('dropDatabase') dropDatabase?: string,
  ) {
    return this.provisioning.deprovisionCompany(companyId, {
      dropDatabase: dropDatabase === 'true' || dropDatabase === '1',
      actorName: 'superadmin',
    });
  }

  /** Phase 3: switch ops traffic between shared service DB and fq_tenant_*. */
  @Patch('tenants/:companyId/routing-mode')
  setRoutingMode(
    @Param('companyId') companyId: string,
    @Body() body: { routingMode: 'shared' | 'tenant' },
  ) {
    const mode = body?.routingMode === 'tenant' ? 'tenant' : 'shared';
    return this.tenants.setRoutingMode(companyId, mode);
  }

  /** Phase 4: sync schemas + copy shared rows + verify counts/checksums. */
  @Post('tenants/:companyId/migrate')
  migrate(
    @Param('companyId') companyId: string,
    @Body() body?: { skipSync?: boolean },
  ) {
    return this.etl.migrateCompany(companyId, {
      skipSync: Boolean(body?.skipSync),
      actorName: 'superadmin',
    });
  }

  @Post('tenants/:companyId/verify')
  verify(@Param('companyId') companyId: string) {
    return this.etl.verifyCompany(companyId);
  }

  @Post('tenants/:companyId/freeze')
  freeze(
    @Param('companyId') companyId: string,
    @Body() body?: { freeze?: boolean },
  ) {
    return this.etl.setWriteFreeze(
      companyId,
      body?.freeze !== false,
      'superadmin',
    );
  }

  @Post('tenants/:companyId/unfreeze')
  unfreeze(@Param('companyId') companyId: string) {
    return this.etl.setWriteFreeze(companyId, false, 'superadmin');
  }

  /** Phase 4: flip routingMode=tenant after verified ETL. */
  @Post('tenants/:companyId/cutover')
  cutover(
    @Param('companyId') companyId: string,
    @Body() body?: { force?: boolean },
  ) {
    return this.etl.cutoverCompany(companyId, {
      force: Boolean(body?.force),
      actorName: 'superadmin',
    });
  }

  /** Phase 4: delete company rows from shared microservice DBs. */
  @Post('tenants/:companyId/archive-shared')
  archive(
    @Param('companyId') companyId: string,
    @Body() body?: { force?: boolean },
  ) {
    return this.etl.archiveSharedData(companyId, {
      force: Boolean(body?.force),
      actorName: 'superadmin',
    });
  }

  @Get('internal/tenants/routing-tenant')
  internalRoutingTenants(@Headers('x-internal-api-key') key?: string) {
    this.tenants.assertInternalKey(key);
    return this.tenants.listTenantRoutedCompanyIds();
  }

  @Post('internal/tenants/:companyId/ensure-driver-schema')
  async internalEnsureDriverSchema(
    @Param('companyId') companyId: string,
    @Headers('x-internal-api-key') key?: string,
  ) {
    this.tenants.assertInternalKey(key);
    return this.ops.ensureCompanySchemas(companyId);
  }

  @Get('internal/tenants/:companyId/connection')
  internalConnection(
    @Param('companyId') companyId: string,
    @Headers('x-internal-api-key') key?: string,
  ) {
    this.tenants.assertInternalKey(key);
    return this.tenants.getConnection(companyId);
  }

  @Patch('internal/tenants/:companyId/connection')
  internalSetConnection(
    @Param('companyId') companyId: string,
    @Headers('x-internal-api-key') key: string | undefined,
    @Body()
    body: {
      connectionUrl?: string;
      status?: string;
      host?: string;
      port?: number;
      lastError?: string;
    },
  ) {
    this.tenants.assertInternalKey(key);
    return this.tenants.setConnection(companyId, body);
  }

  @Post('internal/tenants/:companyId/register')
  internalRegister(
    @Param('companyId') companyId: string,
    @Headers('x-internal-api-key') key: string | undefined,
    @Body() body: { shortName: string },
  ) {
    this.tenants.assertInternalKey(key);
    return this.tenants.registerPending(companyId, body.shortName);
  }

  @Post('internal/tenants/:companyId/provision')
  internalProvision(
    @Param('companyId') companyId: string,
    @Headers('x-internal-api-key') key: string | undefined,
    @Body() body?: { force?: boolean },
  ) {
    this.tenants.assertInternalKey(key);
    return this.provisioning.provisionCompany(companyId, {
      force: Boolean(body?.force),
      actorName: 'internal',
    });
  }

  @Get('internal/tenants/:companyId/custom-roles/:roleId')
  internalCustomRole(
    @Param('companyId') companyId: string,
    @Param('roleId') roleId: string,
    @Headers('x-internal-api-key') key?: string,
  ) {
    this.tenants.assertInternalKey(key);
    return this.tenantLocal.getCustomRole(companyId, roleId);
  }

  @Get('internal/tenants/:companyId/security-policy')
  internalSecurityPolicy(
    @Param('companyId') companyId: string,
    @Headers('x-internal-api-key') key?: string,
  ) {
    this.tenants.assertInternalKey(key);
    return this.tenantLocal.getSecurityPolicy(companyId);
  }
}
