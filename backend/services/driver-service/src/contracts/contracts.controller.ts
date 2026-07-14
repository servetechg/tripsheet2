import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { UpsertContractDto } from './dto/upsert-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Query('driverId') driverId?: string) {
    return this.contractsService.findAll(driverId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  create(@Body() dto: UpsertContractDto) {
    return this.contractsService.upsert(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Post(':id/sign')
  sign(@Param('id') id: string, @Body() dto: SignContractDto) {
    return this.contractsService.sign(id, dto);
  }
}
