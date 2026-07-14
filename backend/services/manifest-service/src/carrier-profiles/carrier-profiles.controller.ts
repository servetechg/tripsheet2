import {
  Controller,
  Get,
  Param,
  Put,
  Query,
  Body,
} from '@nestjs/common';
import { CarrierProfilesService } from './carrier-profiles.service';
import { UpsertCarrierProfileDto } from './dto/upsert-carrier-profile.dto';

@Controller('carrier-profiles')
export class CarrierProfilesController {
  constructor(
    private readonly carrierProfilesService: CarrierProfilesService,
  ) {}

  @Get()
  findAll(@Query('companyId') companyId?: string) {
    if (companyId) {
      return this.carrierProfilesService.findByCompanyId(companyId);
    }
    return this.carrierProfilesService.findAll();
  }

  @Get(':companyId')
  findOne(@Param('companyId') companyId: string) {
    return this.carrierProfilesService.findByCompanyId(companyId);
  }

  @Put(':companyId')
  upsert(
    @Param('companyId') companyId: string,
    @Body() dto: UpsertCarrierProfileDto,
  ) {
    return this.carrierProfilesService.upsert(companyId, dto);
  }
}
