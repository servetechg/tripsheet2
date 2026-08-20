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

  /** Optional override; defaults from shortName → fq_tenant_{slug} */
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** starter | professional | enterprise */
  @IsOptional()
  @IsString()
  planCode?: string;
}
