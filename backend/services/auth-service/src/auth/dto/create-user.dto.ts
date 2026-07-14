import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  companyId?: string | null;
}
