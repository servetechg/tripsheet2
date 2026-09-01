import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { QualificationsService } from './qualifications.service';
import { CreateQualificationDto } from './dto/create-qualification.dto';
import { UpdateQualificationDto } from './dto/update-qualification.dto';

@Controller()
export class QualificationsController {
  constructor(private readonly qualifications: QualificationsService) {}

  @Get('drivers/:driverId/qualifications')
  list(@Param('driverId') driverId: string) {
    return this.qualifications.findByDriver(driverId);
  }

  @Post('drivers/:driverId/qualifications')
  create(
    @Param('driverId') driverId: string,
    @Body() dto: CreateQualificationDto,
  ) {
    return this.qualifications.create(driverId, dto);
  }

  @Patch('qualifications/:id')
  update(@Param('id') id: string, @Body() dto: UpdateQualificationDto) {
    return this.qualifications.update(id, dto);
  }

  @Delete('qualifications/:id')
  remove(@Param('id') id: string) {
    return this.qualifications.remove(id);
  }
}
