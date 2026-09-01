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
  findAll(
    @Query('companyId') companyId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.driversService.findAll(companyId, userId);
  }

  @Get(':id/dispatch-ready')
  dispatchReady(@Param('id') id: string) {
    return this.driversService.dispatchReady(id);
  }

  @Get(':id/border-eligible')
  borderEligible(@Param('id') id: string) {
    return this.driversService.borderEligible(id);
  }

  @Get(':id/performance')
  performance(@Param('id') id: string) {
    return this.driversService.performance(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.driversService.approve(id);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.driversService.suspend(id, body?.reason);
  }

  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.driversService.terminate(id, body?.reason);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.driversService.archive(id);
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
