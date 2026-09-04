import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ProvisioningService } from './provisioning.service';
import { TenantOpsService } from './tenant-ops.service';

@Module({
  imports: [OrgModule],
  controllers: [TenantsController],
  providers: [TenantsService, ProvisioningService, TenantOpsService],
  exports: [TenantsService, ProvisioningService, TenantOpsService],
})
export class TenantsModule {}
