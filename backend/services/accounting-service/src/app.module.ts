import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  TenantRuntimeModule,
  TenantContextMiddleware,
  TenantConnectionMiddleware,
} from '@tripsheet/tenant-runtime';
import { BillingModule } from './billing/billing.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SettlementsModule } from './settlements/settlements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantRuntimeModule.forRoot({ enforceScope: true }),
    PrismaModule,
    SettlementsModule,
    BillingModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware, TenantConnectionMiddleware)
      .forRoutes('*');
  }
}
