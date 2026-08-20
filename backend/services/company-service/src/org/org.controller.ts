import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { TenantLocalService } from './tenant-local.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('companies/:companyId')
export class OrgController {
  constructor(
    private readonly local: TenantLocalService,
    private readonly plans: PlansService,
    private readonly prisma: PrismaService,
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

  private actor(headers: Record<string, string | string[] | undefined>) {
    return {
      id: String(headers['x-user-id'] || '') || undefined,
      name: String(headers['x-user-email'] || '') || undefined,
    };
  }
}
