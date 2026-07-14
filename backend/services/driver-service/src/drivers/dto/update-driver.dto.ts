import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
