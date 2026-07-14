import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.companiesService.toggleActive(id);
  }
}
