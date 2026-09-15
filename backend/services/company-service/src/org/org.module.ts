import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { TenantLocalService } from './tenant-local.service';
import { PlansModule } from '../plans/plans.module';
import { AuditModule } from '../audit/audit.module';
import { MdmService } from '../mdm/mdm.service';
import { EmailDeliveryModule } from '../email-delivery/email-delivery.module';

@Module({
  imports: [PlansModule, AuditModule, EmailDeliveryModule],
  controllers: [OrgController],
  providers: [TenantLocalService, MdmService],
  exports: [TenantLocalService, MdmService],
})
export class OrgModule {}
