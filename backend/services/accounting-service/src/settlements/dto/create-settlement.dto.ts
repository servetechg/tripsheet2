import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SettlementLineDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateSettlementDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  driverId!: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettlementLineDto)
  lines!: SettlementLineDto[];
}
