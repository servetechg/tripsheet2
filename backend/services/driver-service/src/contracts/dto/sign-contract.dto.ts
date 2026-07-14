import { IsIn, IsOptional, IsString } from 'class-validator';

export class SignContractDto {
  @IsIn(['driver', 'admin'])
  role!: 'driver' | 'admin';

  @IsOptional()
  @IsString()
  signature?: string;
}
