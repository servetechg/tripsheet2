import { Module } from '@nestjs/common';
import { AuthSyncService } from './auth-sync.service';

@Module({
  providers: [AuthSyncService],
  exports: [AuthSyncService],
})
export class AuthSyncModule {}
