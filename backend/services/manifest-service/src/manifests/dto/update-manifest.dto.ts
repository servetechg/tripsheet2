import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateManifestDto {
  @IsOptional()
  @IsString()
  @IsIn(['ACI', 'ACE'])
  type?: string;

  @IsOptional()
  @IsString()
  crn?: string;

  @IsOptional()
  @IsString()
  loadId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  truckId?: string;

  @IsOptional()
  @IsString()
  trailerId?: string;

  @IsOptional()
  @IsString()
  portOfEntry?: string;

  @IsOptional()
  @IsString()
  estimatedArrival?: string;

  @IsOptional()
  @IsArray()
  shipments?: unknown[];

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}
