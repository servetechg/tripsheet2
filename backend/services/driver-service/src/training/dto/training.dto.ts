import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTrainingRecordDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  courseCode!: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsString()
  @MinLength(1)
  completedAt!: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  instructor?: string;

  @IsOptional()
  @IsString()
  certificateDocumentId?: string;
}

export class UpdateTrainingRecordDto {
  @IsOptional()
  @IsString()
  courseCode?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  instructor?: string;

  @IsOptional()
  @IsString()
  certificateDocumentId?: string;
}
