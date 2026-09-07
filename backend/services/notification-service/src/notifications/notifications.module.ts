import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EmailModule, SmsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
