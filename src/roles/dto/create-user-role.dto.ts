import { IsUUID, IsEnum } from 'class-validator';
import { RoleType } from '../../auth/types/role.type';

export class CreateUserRoleDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  shopId: string;

  @IsEnum(RoleType)
  type: RoleType;
}
