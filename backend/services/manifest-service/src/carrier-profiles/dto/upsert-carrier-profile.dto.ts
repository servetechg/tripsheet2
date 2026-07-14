import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertCarrierProfileDto {
  @IsOptional()
  @IsString()
  cbsaCarrierCode?: string;

  @IsOptional()
  @IsString()
  scacCode?: string;

  @IsOptional()
  @IsString()
  dotNumber?: string;

  @IsOptional()
  @IsString()
  csnNumber?: string;

  @IsOptional()
  @IsBoolean()
  fastLane?: boolean;
}
