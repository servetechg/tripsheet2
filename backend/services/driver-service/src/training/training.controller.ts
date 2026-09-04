import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TrainingService } from './training.service';
import {
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
} from './dto/training.dto';

@Controller()
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get('drivers/:driverId/training-records')
  list(@Param('driverId') driverId: string) {
    return this.training.findByDriver(driverId);
  }

  @Post('drivers/:driverId/training-records')
  create(
    @Param('driverId') driverId: string,
    @Body() dto: CreateTrainingRecordDto,
  ) {
    return this.training.create(driverId, dto);
  }

  @Patch('training-records/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTrainingRecordDto) {
    return this.training.update(id, dto);
  }

  @Delete('training-records/:id')
  remove(@Param('id') id: string) {
    return this.training.remove(id);
  }
}
