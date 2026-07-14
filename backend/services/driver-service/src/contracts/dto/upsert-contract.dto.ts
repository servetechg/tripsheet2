import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpsertContractDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  driverId!: string;

  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  payType?: string;

  @IsOptional()
  @IsString()
  payRate?: string;

  @IsOptional()
  @IsString()
  payUnit?: string;

  @IsOptional()
  @IsString()
  teamRate?: string;

  @IsOptional()
  @IsString()
  detentionRate?: string;

  @IsOptional()
  @IsString()
  waitRate?: string;

  @IsOptional()
  @IsString()
  fuelSurcharge?: string;

  @IsOptional()
  @IsString()
  vacationPct?: string;

  @IsOptional()
  @IsString()
  trialDays?: string;

  @IsOptional()
  @IsString()
  noticeDays?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsBoolean()
  signedByDriver?: boolean;

  @IsOptional()
  @IsBoolean()
  signedByAdmin?: boolean;

  @IsOptional()
  @IsString()
  signedAt?: string;

  @IsOptional()
  @IsString()
  driverSignature?: string;

  @IsOptional()
  @IsString()
  adminSignature?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
