import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  QUALIFICATION_TYPES,
  type QualificationType,
} from '@tripsheet/shared';

export class CreateQualificationDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @IsIn([...QUALIFICATION_TYPES])
  type!: QualificationType;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  class?: string;

  @IsOptional()
  @IsObject()
  endorsements?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  documentId?: string;
}
