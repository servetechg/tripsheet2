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
import { ActiveLoadsDto } from './dto/active-loads.dto';
import { CreateLoadDto } from './dto/create-load.dto';
import { ListLoadsDto } from './dto/list-loads.dto';
import { UpdateLoadDto } from './dto/update-load.dto';
import { UpdateLoadStatusDto } from './dto/update-load-status.dto';
import { LoadsService } from './loads.service';

@Controller('loads')
export class LoadsController {
  constructor(private readonly loadsService: LoadsService) {}

  @Get()
  findAll(@Query() query: ListLoadsDto) {
    return this.loadsService.findAll(query);
  }

  @Get('active')
  findActive(@Query() query: ActiveLoadsDto) {
    return this.loadsService.findActive(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loadsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLoadDto) {
    return this.loadsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLoadDto) {
    return this.loadsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLoadStatusDto) {
    return this.loadsService.updateStatus(id, dto);
  }

  @Post(':id/simulate-track')
  simulateTrack(@Param('id') id: string) {
    return this.loadsService.simulateTrack(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loadsService.remove(id);
  }
}
