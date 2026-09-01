import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FilesModule } from '../files/files.module';
import { QualificationsModule } from '../qualifications/qualifications.module';

@Module({
  imports: [FilesModule, QualificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
