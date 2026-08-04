import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

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
}
