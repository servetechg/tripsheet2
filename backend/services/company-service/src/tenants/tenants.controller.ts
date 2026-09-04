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
import { TenantOpsService } from './tenant-ops.service';
import { TenantLocalService } from '../org/tenant-local.service';

@Controller()
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly provisioning: ProvisioningService,
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
   * Apply org SQL (+ optional Prisma push) to all active tenants.
   * Safe for CI/CD after deploy.
   */
  @Post('tenants/schema-migrate-all')
  schemaMigrateAll() {
    return this.ops.schemaMigrateAll('superadmin');
  }

  @Get('tenants/:companyId')
  async one(@Param('companyId') companyId: string) {
    const conn = await this.tenants.getConnection(companyId);
    const { connectionUrl: _, ...safe } = conn;
    return { ...safe, hasConnection: Boolean(conn.connectionUrl) };
  }

  /** Provision or retry tenant DB. */
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
