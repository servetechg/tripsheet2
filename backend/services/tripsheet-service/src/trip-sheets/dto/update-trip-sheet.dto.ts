import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateTripSheetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  driverId?: string;

  @IsOptional()
  @IsObject()
  header?: Record<string, unknown>;

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
