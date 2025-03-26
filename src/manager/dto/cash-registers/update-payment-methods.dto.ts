import {
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaymentMethodSource,
  PaymentMethodStatus,
} from '../../entities/register-payment-method.entity';
import { PaymentMethodType } from '../../entities/cash-operation.entity';

export class PaymentMethodDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(PaymentMethodSource)
  source: PaymentMethodSource;

  @IsEnum(PaymentMethodType)
  @IsOptional()
  systemType?: PaymentMethodType;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(PaymentMethodStatus)
  status: PaymentMethodStatus;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;
}

export class UpdatePaymentMethodsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods: PaymentMethodDto[];
}
