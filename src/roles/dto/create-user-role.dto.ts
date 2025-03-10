import { IsUUID, IsEnum } from 'class-validator';
import { RoleType } from '../entities/user-role.entity';

export class CreateUserRoleDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  shopId: string;

  @IsEnum(RoleType)
  role: RoleType;
}
