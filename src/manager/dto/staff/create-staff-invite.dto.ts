import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '../../../auth/types/role.type';
import { IsPhoneNumber } from '../../../common/decorators/phone.decorator';
import { normalizePhoneNumber } from '../../../common/utils/phone.util';

export class CreateStaffInviteDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(RoleType, {
    message: 'Менеджер может создавать только кассиров',
  })
  role?: RoleType;
}
