import { IsString, IsEnum, IsUUID, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '../../auth/types/role.type';
import { IsPhoneNumber } from '../../common/decorators/phone.decorator';
import { normalizePhoneNumber } from '../../common/utils/phone.util';

export class CreateInviteDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;

  @IsEnum(RoleType)
  role: RoleType;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  shopId?: string;
}
