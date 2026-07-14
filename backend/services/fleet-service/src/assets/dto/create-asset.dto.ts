import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsIn(['truck', 'trailer'])
  type!: 'truck' | 'trailer';

  @IsString()
  @MinLength(1)
  unitNo!: string;

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
}
