import { IsOptional, IsString, MinLength } from 'class-validator';

export class ActiveLoadsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;
}
