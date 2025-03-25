import { IsString, IsEnum, IsUUID, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '../../auth/types/role.type';
import { IsPhoneNumber } from '../../common/decorators/phone.decorator';
import { normalizePhoneNumber } from '../../common/utils/phone.util';

export class CreateAdminInviteDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;

  @IsEnum(RoleType, {
    message: 'Администратор может создавать только владельцев',
  })
  role: Extract<RoleType, 'owner'>;

  @IsUUID()
  shopId: string;

  @IsUUID()
  warehouseId: string;
}
