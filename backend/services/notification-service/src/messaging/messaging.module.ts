import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { PushModule } from '../push/push.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [PushModule, InAppNotificationsModule],
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
