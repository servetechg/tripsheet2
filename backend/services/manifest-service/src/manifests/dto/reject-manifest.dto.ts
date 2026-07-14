import { IsOptional, IsString, MinLength } from 'class-validator';

export class RejectManifestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
