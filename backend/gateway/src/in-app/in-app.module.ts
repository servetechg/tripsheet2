import { Module } from '@nestjs/common';
import { InAppNotificationsGateway } from './in-app.gateway';

@Module({
  providers: [InAppNotificationsGateway],
})
export class InAppModule {}
