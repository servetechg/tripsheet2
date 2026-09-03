import { Module } from '@nestjs/common';
import { AuthSyncModule } from '../auth-sync/auth-sync.module';
import { DocumentsModule } from '../documents/documents.module';
import { QualificationsModule } from '../qualifications/qualifications.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [AuthSyncModule, QualificationsModule, DocumentsModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
