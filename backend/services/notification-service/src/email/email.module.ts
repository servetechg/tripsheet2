import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailDeliveryResolverService } from './email-delivery-resolver.service';
import { PlatformEmailSenderService } from './platform-email.sender.service';

@Module({
  providers: [
    EmailDeliveryResolverService,
    PlatformEmailSenderService,
    EmailService,
  ],
  exports: [EmailService, EmailDeliveryResolverService, PlatformEmailSenderService],
})
export class EmailModule {}
