import { IsString, MinLength } from 'class-validator';

export class CreateInviteDto {
  @IsString()
  @MinLength(1)
  companyId!: string;
}
