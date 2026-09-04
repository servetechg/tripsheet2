import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  DRIVER_LIFECYCLE_STATUSES,
  DRIVER_TYPES,
  DRIVER_AVAILABILITY_STATUSES,
  EMPLOYMENT_STATUSES,
  type DriverLifecycleStatus,
  type DriverType,
  type DriverAvailabilityStatus,
  type EmploymentStatus,
} from '@tripsheet/shared';

export class CreateDriverDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

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

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...DRIVER_LIFECYCLE_STATUSES])
  lifecycleStatus?: DriverLifecycleStatus;

  @IsOptional()
  @IsString()
  @IsIn([...DRIVER_AVAILABILITY_STATUSES])
  availabilityStatus?: DriverAvailabilityStatus;

  @IsOptional()
  @IsString()
  @IsIn([...DRIVER_TYPES])
  driverType?: DriverType;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn([...EMPLOYMENT_STATUSES])
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsString()
  probationEndDate?: string;

  @IsOptional()
  @IsString()
  seniorityDate?: string;

  @IsOptional()
  @IsString()
  managerUserId?: string;

  @IsOptional()
  @IsString()
  dispatcherUserId?: string;

  @IsOptional()
  @IsString()
  preferredName?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsObject()
  ownerOperatorProfile?: Record<string, unknown>;
}
