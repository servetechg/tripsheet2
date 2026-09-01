import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  EQUIPMENT_ASSIGNMENT_ROLES,
  EQUIPMENT_ASSIGNMENT_TYPES,
  type EquipmentAssignmentRole,
  type EquipmentAssignmentType,
} from '@tripsheet/shared';

export class AssignEquipmentDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  assetId!: string;

  @IsString()
  @IsIn([...EQUIPMENT_ASSIGNMENT_TYPES])
  assetType!: EquipmentAssignmentType;

  @IsOptional()
  @IsString()
  @IsIn([...EQUIPMENT_ASSIGNMENT_ROLES])
  role?: EquipmentAssignmentRole;

  @IsOptional()
  @IsString()
  unitNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
