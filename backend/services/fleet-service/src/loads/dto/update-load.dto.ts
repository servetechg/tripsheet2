import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateLoadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  driverId?: string;

  @IsOptional()
  @IsString()
  truckId?: string;

  @IsOptional()
  @IsString()
  trailerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  origin?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  destination?: string;

  @IsOptional()
  @IsString()
  pickupTime?: string;

  @IsOptional()
  @IsString()
  eta?: string;

  @IsOptional()
  @IsString()
  tripNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  truckNo?: string;

  @IsOptional()
  @IsString()
  trailerNo?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  lastUpdate?: string;

  @IsOptional()
  @IsIn(['assigned', 'in_transit', 'delivered', 'cancelled'])
  status?: 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
}
