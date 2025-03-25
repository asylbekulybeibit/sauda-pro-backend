import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '../../auth/types/role.type';

export class CreateUserRoleDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  warehouseId?: string;

  @IsEnum(RoleType)
  type: RoleType;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  shopId?: string;
}
