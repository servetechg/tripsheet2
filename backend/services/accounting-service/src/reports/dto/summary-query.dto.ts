import { IsString, MinLength } from 'class-validator';

export class SummaryQueryDto {
  @IsString()
  @MinLength(1)
  companyId!: string;
}
