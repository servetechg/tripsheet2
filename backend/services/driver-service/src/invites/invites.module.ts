import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { FilesModule } from '../files/files.module';
import { QualificationsModule } from '../qualifications/qualifications.module';

@Module({
  imports: [FilesModule, QualificationsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
