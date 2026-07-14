import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  shortName!: string;

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
