import {
  IsArray,
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
  actualDelivery?: string;

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
  customerRate?: number;

  @IsOptional()
  @IsNumber()
  carrierCost?: number;

  @IsOptional()
  @IsNumber()
  fuelSurcharge?: number;

  @IsOptional()
  @IsNumber()
  accessorials?: number;

  @IsOptional()
  @IsNumber()
  detentionHours?: number;

  @IsOptional()
  @IsNumber()
  detentionRate?: number;

  @IsOptional()
  @IsNumber()
  miles?: number;

  @IsOptional()
  @IsArray()
  stops?: unknown[];

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

  @IsOptional()
  @IsString()
  brokerId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  originLocationId?: string;

  @IsOptional()
  @IsString()
  destinationLocationId?: string;

  @IsOptional()
  @IsString()
  brokerName?: string;

  @IsOptional()
  @IsString()
  carrierId?: string;

  @IsOptional()
  @IsString()
  carrierName?: string;

  @IsOptional()
  @IsString()
  commodityId?: string;

  @IsOptional()
  @IsString()
  commodityName?: string;

  @IsOptional()
  crossBorder?: boolean;

  @IsOptional()
  @IsString()
  portOfEntryId?: string;

  @IsOptional()
  @IsString()
  portOfEntryCode?: string;

  @IsOptional()
  @IsString()
  portOfEntryName?: string;

  @IsOptional()
  @IsString()
  customsProgram?: string;

  @IsOptional()
  customsAce?: boolean;

  @IsOptional()
  customsAci?: boolean;

  @IsOptional()
  customsPaps?: boolean;

  @IsOptional()
  customsPars?: boolean;
}
