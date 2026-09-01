import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';

@Controller()
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get('drivers/:driverId/equipment-assignments')
  list(@Param('driverId') driverId: string) {
    return this.equipment.findByDriver(driverId);
  }

  @Post('drivers/:driverId/equipment-assignments')
  assign(
    @Param('driverId') driverId: string,
    @Body() dto: AssignEquipmentDto,
  ) {
    return this.equipment.assign(driverId, dto);
  }

  @Patch('equipment-assignments/:id/unassign')
  unassign(@Param('id') id: string) {
    return this.equipment.unassign(id);
  }
}
