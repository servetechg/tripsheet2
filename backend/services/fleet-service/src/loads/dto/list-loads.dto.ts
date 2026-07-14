import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ListLoadsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;

  @IsOptional()
  @IsIn(['assigned', 'in_transit', 'delivered', 'cancelled'])
  status?: 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

  @IsOptional()
  @IsString()
  @MinLength(1)
  driverId?: string;
}
