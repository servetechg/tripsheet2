import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PUSH_PLATFORMS, type PushPlatform } from '@tripsheet/shared';

export class RegisterPushDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsOptional()
  @IsIn(PUSH_PLATFORMS)
  platform?: PushPlatform;
}

export class UnregisterPushDto {
  @IsOptional()
  @IsString()
  token?: string;
}

export class SendPushDto {
  @IsString()
  companyId!: string;

  @IsString()
  userId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  data?: Record<string, string>;
}
