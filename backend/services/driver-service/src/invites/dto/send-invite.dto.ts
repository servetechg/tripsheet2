import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class SendInviteDto {
  @IsIn(['email', 'sms'])
  channel!: 'email' | 'sms';

  /** Overrides the address stored on the invite; required for SMS. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  to?: string;
}
