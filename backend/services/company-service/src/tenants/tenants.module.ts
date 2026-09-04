import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ProvisioningService } from './provisioning.service';
import { EtlService } from './etl.service';
import { TenantOpsService } from './tenant-ops.service';

@Module({
  imports: [OrgModule],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    ProvisioningService,
    EtlService,
    TenantOpsService,
  ],
  exports: [
    TenantsService,
    ProvisioningService,
    EtlService,
    TenantOpsService,
  ],
})
export class TenantsModule {}
