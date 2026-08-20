import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const STAFF_ROLES = [
  'dispatcher',
  'dispatcher_supervisor',
  'general_manager',
  'fleet_manager',
  'safety_manager',
  'accountant',
  'hr_manager',
  'maintenance_coordinator',
] as const;

export class CreateInviteDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsOptional()
  @IsIn(['driver', 'staff'])
  kind?: 'driver' | 'staff';

  @IsOptional()
  @IsIn([...STAFF_ROLES, 'driver'])
  role?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
