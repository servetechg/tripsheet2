import { Module } from '@nestjs/common';
import { CarrierProfilesController } from './carrier-profiles.controller';
import { CarrierProfilesService } from './carrier-profiles.service';

@Module({
  controllers: [CarrierProfilesController],
  providers: [CarrierProfilesService],
})
export class CarrierProfilesModule {}
