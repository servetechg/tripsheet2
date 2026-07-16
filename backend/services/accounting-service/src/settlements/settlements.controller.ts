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
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';
import { ListSettlementsDto } from './dto/list-settlements.dto';

@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  findAll(@Query() query: ListSettlementsDto) {
    return this.settlementsService.findAll(
      query.companyId,
      query.driverId,
      query.status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.settlementsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSettlementDto) {
    return this.settlementsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSettlementDto) {
    return this.settlementsService.update(id, dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.settlementsService.approve(id);
  }

  @Post(':id/pay')
  pay(@Param('id') id: string) {
    return this.settlementsService.pay(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.settlementsService.remove(id);
  }
}
