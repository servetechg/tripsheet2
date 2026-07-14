import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';

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
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}
