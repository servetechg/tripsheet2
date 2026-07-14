import {
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpsertDocumentDto {
  @IsString()
  @MinLength(1)
  driverId!: string;

  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  fileType?: string;

  /** Data URL or legacy inline payload — uploaded to Cloudinary when configured */
  @IsOptional()
  @IsString()
  fileData?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  cloudinaryPublicId?: string;

  @IsOptional()
  @IsString()
  uploadedAt?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
