import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(16)
  refreshToken!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  refreshToken?: string;
}

export class PatchSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;

  @IsOptional()
  @IsBoolean()
  trusted?: boolean;
}
