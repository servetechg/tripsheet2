import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  findAll(@Query('companyId') companyId?: string) {
    return this.driversService.findAll(companyId);
  }

  @Get(':id/dispatch-ready')
  dispatchReady(@Param('id') id: string) {
    return this.driversService.dispatchReady(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }
}
