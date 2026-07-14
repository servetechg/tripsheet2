import { IsIn } from 'class-validator';

export class UpdateLoadStatusDto {
  @IsIn(['assigned', 'in_transit', 'delivered', 'cancelled'])
  status!: 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
}
