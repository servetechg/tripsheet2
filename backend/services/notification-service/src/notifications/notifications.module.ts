import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { PushModule } from '../push/push.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EmailModule, SmsModule, PushModule, InAppNotificationsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
