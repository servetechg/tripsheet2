import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { DriversModule } from './drivers/drivers.module';
import { DocumentsModule } from './documents/documents.module';
import { ContractsModule } from './contracts/contracts.module';
import { InvitesModule } from './invites/invites.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    FilesModule,
    DriversModule,
    DocumentsModule,
    ContractsModule,
    InvitesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
