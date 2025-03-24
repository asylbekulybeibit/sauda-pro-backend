import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import {
  CashOperationType,
  PaymentMethodType,
} from '../../entities/cash-operation.entity';

export class CreateCashOperationDto {
  @IsUUID()
  @IsNotEmpty()
  cashRegisterId: string;

  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsEnum(CashOperationType)
  @IsNotEmpty()
  operationType: CashOperationType;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(PaymentMethodType)
  @IsNotEmpty()
  paymentMethod: PaymentMethodType;
}
