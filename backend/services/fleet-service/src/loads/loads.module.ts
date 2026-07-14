import { Module } from '@nestjs/common';
import { LoadsController } from './loads.controller';
import { LoadsService } from './loads.service';

@Module({
  controllers: [LoadsController],
  providers: [LoadsService],
})
export class LoadsModule {}
