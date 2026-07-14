import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ListAssetsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;

  @IsOptional()
  @IsIn(['truck', 'trailer'])
  type?: 'truck' | 'trailer';
}
