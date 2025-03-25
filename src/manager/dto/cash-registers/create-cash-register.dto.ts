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
import { CashRegisterType } from '../../entities/cash-register.entity';
import { PaymentMethodType } from '../../entities/cash-operation.entity';

export class PaymentMethodItemDto {
  @IsString()
  name: string;

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
  @IsOptional()
  status?: PaymentMethodStatus;
}

export class CreateCashRegisterDto {
  @IsString()
  name: string;

  @IsEnum(CashRegisterType)
  type: CashRegisterType;

  @IsString()
  @IsOptional()
  location?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodItemDto)
  paymentMethods: PaymentMethodItemDto[];
}
