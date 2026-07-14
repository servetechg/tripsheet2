import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTripSheetDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  driverId!: string;

  @IsObject()
  header!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  trips?: unknown[];

  @IsOptional()
  @IsArray()
  expenses?: unknown[];

  @IsOptional()
  @IsString()
  notes?: string;
}
