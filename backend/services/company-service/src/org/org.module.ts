import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { TenantLocalService } from './tenant-local.service';
import { PlansModule } from '../plans/plans.module';
import { AuditModule } from '../audit/audit.module';
import { MdmService } from '../mdm/mdm.service';

@Module({
  imports: [PlansModule, AuditModule],
  controllers: [OrgController],
  providers: [TenantLocalService, MdmService],
  exports: [TenantLocalService, MdmService],
})
export class OrgModule {}
