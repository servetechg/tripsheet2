import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  /** Ignored here — auth-service creates the login user separately. */
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

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
