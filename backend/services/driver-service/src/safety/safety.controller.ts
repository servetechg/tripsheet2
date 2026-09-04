import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SafetyService } from './safety.service';
import {
  CreateSafetyEventDto,
  UpdateSafetyEventDto,
} from './dto/safety.dto';

@Controller()
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Get('drivers/:driverId/safety-events')
  list(@Param('driverId') driverId: string) {
    return this.safety.findByDriver(driverId);
  }

  @Post('drivers/:driverId/safety-events')
  create(
    @Param('driverId') driverId: string,
    @Body() dto: CreateSafetyEventDto,
  ) {
    return this.safety.create(driverId, dto);
  }

  @Patch('safety-events/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSafetyEventDto) {
    return this.safety.update(id, dto);
  }

  @Delete('safety-events/:id')
  remove(@Param('id') id: string) {
    return this.safety.remove(id);
  }
}
