import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  shortName?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
