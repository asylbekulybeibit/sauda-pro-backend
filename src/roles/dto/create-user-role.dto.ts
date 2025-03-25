import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { RoleType } from '../../auth/types/role.type';

export class CreateUserRoleDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  warehouseId: string;

  @IsEnum(RoleType)
  type: RoleType;

  @IsOptional()
  @IsUUID()
  shopId?: string;
}
