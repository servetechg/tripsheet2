import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

class InviteDocDto {
  @IsString()
  @MinLength(1)
  type!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsString()
  fileData?: string;

  @IsOptional()
  @IsString()
  uploadedAt?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class InviteContractDto {
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

class InviteProfileDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  /** Prefer creating auth user via gateway/frontend; optional here. */
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  licenseNo?: string;

  @IsOptional()
  @IsString()
  citizenship?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  fastCard?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  sin?: string;
}

export class CompleteInviteDto {
  @ValidateNested()
  @Type(() => InviteProfileDto)
  profile!: InviteProfileDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteDocDto)
  docs?: InviteDocDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => InviteContractDto)
  contract?: InviteContractDto;
}
