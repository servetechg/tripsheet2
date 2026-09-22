import { Module } from '@nestjs/common';
import { VpicController } from './vpic.controller';
import { VpicService } from './vpic.service';

@Module({
  controllers: [VpicController],
  providers: [VpicService],
  exports: [VpicService],
})
export class VpicModule {}
