import { Module } from '@nestjs/common';
import { InAppNotificationsController } from './in-app-notifications.controller';
import { InAppNotificationsService } from './in-app-notifications.service';
import { InAppRealtimePublisher } from './in-app-realtime.publisher';

@Module({
  controllers: [InAppNotificationsController],
  providers: [InAppNotificationsService, InAppRealtimePublisher],
  exports: [InAppNotificationsService],
})
export class InAppNotificationsModule {}
