import { IsOptional, IsString } from 'class-validator';

export class ListSettlementsDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
