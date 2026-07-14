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
import { TripSheetsService } from './trip-sheets.service';
import { CreateTripSheetDto } from './dto/create-trip-sheet.dto';
import { UpdateTripSheetDto } from './dto/update-trip-sheet.dto';

@Controller('trip-sheets')
export class TripSheetsController {
  constructor(private readonly tripSheetsService: TripSheetsService) {}

  @Get()
  findAll(
    @Query('companyId') companyId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.tripSheetsService.findAll(companyId, driverId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripSheetsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTripSheetDto) {
    return this.tripSheetsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTripSheetDto) {
    return this.tripSheetsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tripSheetsService.remove(id);
  }
}
