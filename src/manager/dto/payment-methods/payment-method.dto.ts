import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { PaymentMethodType } from '../../entities/cash-operation.entity';
import {
  PaymentMethodSource,
  PaymentMethodStatus,
} from '../../entities/register-payment-method.entity';

export class PaymentMethodDto {
  @IsEnum(PaymentMethodSource)
  source: PaymentMethodSource;

  @IsEnum(PaymentMethodType)
  @IsOptional()
  systemType?: PaymentMethodType;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  isActive: boolean;

  @IsEnum(PaymentMethodStatus)
  status: PaymentMethodStatus;
}
