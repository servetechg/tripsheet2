import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health/health.controller';
import { CompaniesModule } from './companies/companies.module';
import { PlansModule } from './plans/plans.module';
import { TenantsModule } from './tenants/tenants.module';
import { PrismaModule } from './prisma/prisma.module';

import { OrgModule } from './org/org.module';
import { EmailDeliveryModule } from './email-delivery/email-delivery.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PrismaModule,
    PlansModule,
    TenantsModule,
    CompaniesModule,
    OrgModule,
    AuditModule,
    EmailDeliveryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
