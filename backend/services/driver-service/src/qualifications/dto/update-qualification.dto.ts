import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import {
  QUALIFICATION_STATUSES,
  QUALIFICATION_TYPES,
  type QualificationStatus,
  type QualificationType,
} from '@tripsheet/shared';

export class UpdateQualificationDto {
  @IsOptional()
  @IsString()
  @IsIn([...QUALIFICATION_TYPES])
  type?: QualificationType;

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

  @IsOptional()
  @IsString()
  @IsIn([...QUALIFICATION_STATUSES])
  status?: QualificationStatus;
}
