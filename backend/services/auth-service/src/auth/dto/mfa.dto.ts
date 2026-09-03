import { IsOptional, IsString, MinLength } from 'class-validator';

export class MfaCodeDto {
  @IsString()
  @MinLength(4)
  code!: string;
}

export class MfaChallengeDto {
  @IsString()
  @MinLength(16)
  mfaToken!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}

export class MfaDisableDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}

export class MfaEnrollConfirmDto {
  @IsString()
  @MinLength(6)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}

export class MfaEnrollLoginStartDto {
  @IsString()
  @MinLength(16)
  mfaToken!: string;
}

export class MfaEnrollLoginConfirmDto {
  @IsString()
  @MinLength(16)
  mfaToken!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}
