import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CashRegisterType } from '../../entities/cash-register.entity';
import { PaymentMethodDto } from '../payment-methods/payment-method.dto';

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
  @Type(() => PaymentMethodDto)
  paymentMethods: PaymentMethodDto[];
}
