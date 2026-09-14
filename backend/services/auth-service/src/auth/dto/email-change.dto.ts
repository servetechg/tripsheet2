import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail()
  newEmail!: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  @MinLength(16)
  token!: string;
}
