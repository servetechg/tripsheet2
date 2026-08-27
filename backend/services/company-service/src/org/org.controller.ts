import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { TenantLocalService } from './tenant-local.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { MdmService } from '../mdm/mdm.service';

@Controller('companies/:companyId')
export class OrgController {
  constructor(
    private readonly local: TenantLocalService,
    private readonly plans: PlansService,
    private readonly prisma: PrismaService,
    private readonly mdm: MdmService,
  ) {}

  private assertCompanyAccess(
    companyId: string,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const role = String(headers['x-user-role'] || '');
    const hdrCompany = String(headers['x-company-id'] || '');
    if (role === 'superadmin') return;
    if (role && hdrCompany && hdrCompany !== companyId) {
      throw new ForbiddenException('Cannot access another company');
    }
  }

  @Get('entitlements')
  async entitlements(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: true, subscription: true },
    });
    if (!company) return { companyId, features: {}, maxDrivers: 0 };
    const plan =
      company.plan ||
      (await this.plans.findByCode('starter').catch(() => null));
    return {
      companyId,
      planCode: plan?.code || 'starter',
      planName: plan?.name || 'Starter',
      maxDrivers: plan?.maxDrivers ?? 10,
      features: (plan?.features as Record<string, boolean>) || {},
      subscriptionStatus: company.subscription?.status || 'none',
      companyStatus: company.status,
      active: company.active,
    };
  }

  @Get('settings')
  settings(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.getSettings(companyId);
  }

  @Patch('settings')
  patchSettings(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.patchSettings(companyId, body);
  }

  @Get('branding')
  branding(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.getBranding(companyId);
  }

  @Patch('branding')
  patchBranding(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.patchBranding(companyId, body);
  }

  @Get('branches')
  branches(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.listBranches(companyId);
  }

  @Post('branches')
  createBranch(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.upsertBranch(companyId, body);
  }

  @Patch('branches/:branchId')
  updateBranch(
    @Param('companyId') companyId: string,
    @Param('branchId') branchId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.upsertBranch(companyId, { ...body, id: branchId });
  }

  @Delete('branches/:branchId')
  deleteBranch(
    @Param('companyId') companyId: string,
    @Param('branchId') branchId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.softDeleteBranch(companyId, branchId);
  }

  @Get('departments')
  departments(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.listDepartments(companyId);
  }

  @Post('departments')
  createDepartment(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.upsertDepartment(companyId, body);
  }

  @Get('documents')
  documents(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.listDocuments(companyId);
  }

  @Post('documents')
  createDocument(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.createDocument(companyId, body);
  }

  @Delete('documents/:docId')
  deleteDocument(
    @Param('companyId') companyId: string,
    @Param('docId') docId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.deleteDocument(companyId, docId);
  }

  @Get('api-keys')
  apiKeys(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.listApiKeys(companyId);
  }

  @Post('api-keys')
  createApiKey(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.createApiKey(companyId, body);
  }

  @Post('api-keys/:keyId/revoke')
  revokeApiKey(
    @Param('companyId') companyId: string,
    @Param('keyId') keyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.revokeApiKey(companyId, keyId);
  }

  @Get('security-policy')
  security(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.getSecurityPolicy(companyId);
  }

  @Patch('security-policy')
  patchSecurity(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.patchSecurityPolicy(companyId, body);
  }

  @Get('notification-rules')
  notificationRules(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.listNotificationRules(companyId);
  }

  @Post('notification-rules')
  upsertRule(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.upsertNotificationRule(companyId, body);
  }

  @Get('custom-roles')
  listCustomRoles(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.listCustomRoles(companyId);
  }

  @Post('custom-roles')
  createCustomRole(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.createCustomRole(companyId, body, this.actor(headers));
  }

  @Get('custom-roles/:roleId')
  getCustomRole(
    @Param('companyId') companyId: string,
    @Param('roleId') roleId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.getCustomRole(companyId, roleId);
  }

  @Patch('custom-roles/:roleId')
  updateCustomRole(
    @Param('companyId') companyId: string,
    @Param('roleId') roleId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.updateCustomRole(
      companyId,
      roleId,
      body,
      this.actor(headers),
    );
  }

  @Delete('custom-roles/:roleId')
  deleteCustomRole(
    @Param('companyId') companyId: string,
    @Param('roleId') roleId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.local.deleteCustomRole(companyId, roleId, this.actor(headers));
  }

  // ── MDM Phase 2: locations + parties ─────────────────────────────
  @Get('locations')
  listLocations(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listLocations(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('locations')
  createLocation(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createLocation(companyId, body);
  }

  @Patch('locations/:id')
  updateLocation(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateLocation(companyId, id, body);
  }

  @Get('brokers')
  listBrokers(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listBrokers(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('brokers')
  createBroker(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createBroker(companyId, body);
  }

  @Patch('brokers/:id')
  updateBroker(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateBroker(companyId, id, body);
  }

  @Get('customers')
  listCustomers(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listCustomers(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('customers')
  createCustomer(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createCustomer(companyId, body);
  }

  @Patch('customers/:id')
  updateCustomer(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateCustomer(companyId, id, body);
  }

  @Get('consignees')
  listConsignees(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listConsignees(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('consignees')
  createConsignee(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createConsignee(companyId, body);
  }

  @Patch('consignees/:id')
  updateConsignee(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateConsignee(companyId, id, body);
  }

  @Get('carriers')
  listCarriers(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listCarriers(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('carriers')
  createCarrier(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createCarrier(companyId, body);
  }

  @Patch('carriers/:id')
  updateCarrier(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateCarrier(companyId, id, body);
  }

  /** Explicit MDM merge (admin). Soft-archives absorbId; reassigns FKs to survivorId. */
  @Post('mdm/merge')
  mergeMdm(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.mergeParties(
      companyId,
      {
        entityType: String(body.entityType || ''),
        survivorId: String(body.survivorId || ''),
        absorbId: String(body.absorbId || ''),
      },
      this.actor(headers),
    );
  }

  @Get('mdm/export')
  exportMdm(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('entity') entity?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.exportCsv(companyId, String(entity || ''));
  }

  @Post('mdm/import')
  importMdm(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.importCsv(companyId, body, this.actor(headers));
  }

  @Get('commodities')
  listCommodities(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listCommodities(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('commodities')
  createCommodity(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createCommodity(companyId, body);
  }

  @Patch('commodities/:id')
  updateCommodity(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateCommodity(companyId, id, body);
  }

  @Get('warehouses')
  listWarehouses(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listWarehouses(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('warehouses')
  createWarehouse(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createWarehouse(companyId, body);
  }

  @Patch('warehouses/:id')
  updateWarehouse(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateWarehouse(companyId, id, body);
  }

  @Get('border-crossings')
  listBorderCrossings(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listBorderCrossings(companyId);
  }

  @Get('ports-of-entry')
  listPorts(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
    @Query('country') country?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listPortsOfEntry(companyId, {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
      country,
    });
  }

  @Get('ports-of-entry/:id')
  getPort(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.getPortOfEntry(companyId, id);
  }

  @Get('ports-of-entry/:id/customs')
  portCustoms(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.resolvePortCustoms(companyId, id);
  }

  @Patch('ports-of-entry/:id')
  updatePort(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updatePortOfEntry(companyId, id, body);
  }

  @Get('maintenance-vendors')
  listVendors(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listOpsNamed(companyId, 'MaintenanceVendor', {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('maintenance-vendors')
  createVendor(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createOpsNamed(companyId, 'MaintenanceVendor', body);
  }

  @Patch('maintenance-vendors/:id')
  updateVendor(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateOpsNamed(companyId, 'MaintenanceVendor', id, body);
  }

  @Get('fuel-stations')
  listFuel(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listOpsNamed(companyId, 'FuelStation', {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('fuel-stations')
  createFuel(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createOpsNamed(companyId, 'FuelStation', body);
  }

  @Patch('fuel-stations/:id')
  updateFuel(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateOpsNamed(companyId, 'FuelStation', id, body);
  }

  @Get('insurance-providers')
  listInsurance(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listOpsNamed(companyId, 'InsuranceProvider', {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('insurance-providers')
  createInsurance(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createOpsNamed(companyId, 'InsuranceProvider', body);
  }

  @Patch('insurance-providers/:id')
  updateInsurance(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateOpsNamed(companyId, 'InsuranceProvider', id, body);
  }

  @Get('cost-centers')
  listCostCenters(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listOpsCoded(companyId, 'CostCenter', {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('cost-centers')
  createCostCenter(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createOpsCoded(companyId, 'CostCenter', body);
  }

  @Patch('cost-centers/:id')
  updateCostCenter(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateOpsCoded(companyId, 'CostCenter', id, body);
  }

  @Get('payroll-categories')
  listPayroll(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listOpsCoded(companyId, 'PayrollCategory', {
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('payroll-categories')
  createPayroll(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createOpsCoded(companyId, 'PayrollCategory', body);
  }

  @Patch('payroll-categories/:id')
  updatePayroll(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateOpsCoded(companyId, 'PayrollCategory', id, body);
  }

  @Get('reference-data')
  listRefs(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('selectableOnly') selectableOnly?: string,
    @Query('kind') kind?: string,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.listReferenceData(companyId, {
      kind,
      selectableOnly: selectableOnly === '1' || selectableOnly === 'true',
    });
  }

  @Post('reference-data')
  createRef(
    @Param('companyId') companyId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.createReferenceData(companyId, body);
  }

  @Patch('reference-data/:id')
  updateRef(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertCompanyAccess(companyId, headers);
    return this.mdm.updateReferenceData(companyId, id, body);
  }

  private actor(headers: Record<string, string | string[] | undefined>) {
    return {
      id: String(headers['x-user-id'] || '') || undefined,
      name: String(headers['x-user-email'] || '') || undefined,
    };
  }
}
