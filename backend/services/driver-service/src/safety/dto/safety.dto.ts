import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SAFETY_EVENT_TYPES, type SafetyEventType } from '@tripsheet/shared';

export class CreateSafetyEventDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @IsIn([...SAFETY_EVENT_TYPES])
  type!: SafetyEventType;

  @IsString()
  @MinLength(1)
  occurredAt!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsBoolean()
  preventable?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSafetyEventDto {
  @IsOptional()
  @IsString()
  @IsIn([...SAFETY_EVENT_TYPES])
  type?: SafetyEventType;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  preventable?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}
