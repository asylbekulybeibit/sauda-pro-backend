import { IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsPhoneNumber } from '../../common/decorators/phone.decorator';
import { normalizePhoneNumber } from '../../common/utils/phone.util';

export class GenerateOtpDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;
}

export class VerifyOtpDto {
  @IsPhoneNumber()
  @Transform(({ value }) => normalizePhoneNumber(value))
  phone: string;

  @IsString()
  code: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
