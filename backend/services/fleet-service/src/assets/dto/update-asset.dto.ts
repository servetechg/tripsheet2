import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ASSET_STATUS_INPUT } from '../asset-status';

export class UpdateAssetDto {
  @IsOptional()
  @IsIn(['truck', 'trailer', 'equipment'])
  type?: 'truck' | 'trailer' | 'equipment';

  @IsOptional()
  @IsString()
  @MinLength(1)
  unitNo?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  plate?: string;

  @IsOptional()
  @IsIn([...ASSET_STATUS_INPUT])
  status?: (typeof ASSET_STATUS_INPUT)[number];

  @IsOptional()
  @IsString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsString()
  plateExpiry?: string;

  @IsOptional()
  @IsString()
  permitExpiry?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  equipmentTypeCode?: string;

  @IsOptional()
  @IsString()
  insuranceProviderId?: string;

  @IsOptional()
  @IsString()
  insuranceProviderName?: string;
}
