import { IsString, IsEnum, IsUUID } from 'class-validator';
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

  @IsUUID()
  shopId: string;
}
