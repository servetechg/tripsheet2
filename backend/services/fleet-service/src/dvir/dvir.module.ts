import { Module } from '@nestjs/common';
import { DvirController } from './dvir.controller';
import { DvirService } from './dvir.service';

@Module({
  controllers: [DvirController],
  providers: [DvirService],
})
export class DvirModule {}
