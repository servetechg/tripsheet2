import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  TenantRuntimeModule,
  TenantContextMiddleware,
  TenantConnectionMiddleware,
} from '@tripsheet/tenant-runtime';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthSyncModule } from './auth-sync/auth-sync.module';
import { DriversModule } from './drivers/drivers.module';
import { DocumentsModule } from './documents/documents.module';
import { ContractsModule } from './contracts/contracts.module';
import { InvitesModule } from './invites/invites.module';
import { FilesModule } from './files/files.module';
import { QualificationsModule } from './qualifications/qualifications.module';
import { EquipmentModule } from './equipment/equipment.module';
import { SafetyModule } from './safety/safety.module';
import { TrainingModule } from './training/training.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantRuntimeModule.forRoot({ enforceScope: true }),
    PrismaModule,
    AuthSyncModule,
    FilesModule,
    QualificationsModule,
    EquipmentModule,
    SafetyModule,
    TrainingModule,
    DriversModule,
    DocumentsModule,
    ContractsModule,
    InvitesModule,
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
