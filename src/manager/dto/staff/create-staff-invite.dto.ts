import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '../../../roles/entities/user-role.entity';
import { IsPhoneNumber } from '../../../common/decorators/phone.decorator';
import { normalizePhoneNumber } from '../../../common/utils/phone.util';

export class CreateStaffInviteDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsEnum(RoleType, {
    message: 'Менеджер может создавать только кассиров',
  })
  role: Extract<RoleType, 'cashier'>;
}
