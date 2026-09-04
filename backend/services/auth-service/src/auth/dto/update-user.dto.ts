import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';
import { normalizeRoleCode } from '../../rbac/rbac.catalog';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  companyId?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeRoleCode(value) : value,
  )
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  /** Tenant custom role id; null/empty clears and uses the system role. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== null)
  @IsString()
  customRoleId?: string | null;

  /** Chapter 4 lifecycle: active | inactive | suspended | locked | archived */
  @IsOptional()
  @IsString()
  status?: string;
}
