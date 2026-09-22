import { Controller, Get, Param, Query } from '@nestjs/common';
import { VpicService, type VpicAssetType } from './vpic.service';

@Controller('assets/vpic')
export class VpicController {
  constructor(private readonly vpic: VpicService) {}

  /** Model years for North American (US/Canada) VIN-standard vehicles. */
  @Get('years')
  years() {
    return { years: this.vpic.listYears(), source: 'nhtsa_vpic' as const };
  }

  @Get('makes')
  async makes(@Query('vehicleType') vehicleType?: string) {
    const type = parseAssetType(vehicleType);
    const makes = await this.vpic.listMakes(type);
    return { makes, vehicleType: type, source: 'nhtsa_vpic' as const };
  }

  @Get('models')
  async models(
    @Query('make') make: string,
    @Query('year') year: string,
  ) {
    const models = await this.vpic.listModels(make, year);
    return { models, make, year, source: 'nhtsa_vpic' as const };
  }

  @Get('decode/:vin')
  decode(@Param('vin') vin: string) {
    return this.vpic.decodeVin(vin);
  }
}

function parseAssetType(raw?: string): VpicAssetType {
  const t = String(raw || 'truck').toLowerCase();
  if (t === 'trailer') return 'trailer';
  if (t === 'equipment') return 'equipment';
  return 'truck';
}
