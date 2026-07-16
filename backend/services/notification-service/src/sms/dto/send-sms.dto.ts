import {
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SendSmsDto {
  @IsString()
  @MinLength(1)
  to!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
