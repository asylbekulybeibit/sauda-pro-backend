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
  PaymentMethodType,
  PaymentMethodSource,
  PaymentMethodStatus,
} from '../../enums/common.enums';
import { CashRegisterType } from '../../entities/cash-register.entity';

export class PaymentMethodItemDto {
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
  @IsOptional()
  status?: PaymentMethodStatus;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;
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
  @IsOptional()
  paymentMethods?: PaymentMethodItemDto[];
}
