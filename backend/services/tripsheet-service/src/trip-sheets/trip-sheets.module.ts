import { Module } from '@nestjs/common';
import { TripSheetsController } from './trip-sheets.controller';
import { TripSheetsService } from './trip-sheets.service';

@Module({
  controllers: [TripSheetsController],
  providers: [TripSheetsService],
})
export class TripSheetsModule {}
