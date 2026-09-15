import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PlansModule } from '../plans/plans.module';
import { TenantsModule } from '../tenants/tenants.module';
import { EmailDeliveryModule } from '../email-delivery/email-delivery.module';

@Module({
  imports: [PlansModule, TenantsModule, EmailDeliveryModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
