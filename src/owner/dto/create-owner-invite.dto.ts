import { IsString, IsEnum, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '../../roles/entities/user-role.entity';
import { IsPhoneNumber } from '../../common/decorators/phone.decorator';
import { normalizePhoneNumber } from '../../common/utils/phone.util';

export class CreateOwnerInviteDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;

  @IsEnum(RoleType, {
    message: 'Владелец может создавать только менеджеров и кассиров',
  })
  role: Extract<RoleType, 'manager' | 'cashier'>;

  @IsUUID()
  shopId: string;
}
