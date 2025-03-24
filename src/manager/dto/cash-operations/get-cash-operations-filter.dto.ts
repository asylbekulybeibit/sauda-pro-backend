import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import {
  CashOperationType,
  PaymentMethodType,
} from '../../entities/cash-operation.entity';

export class GetCashOperationsFilterDto {
  @IsUUID()
  @IsOptional()
  cashRegisterId?: string;

  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsEnum(CashOperationType)
  @IsOptional()
  operationType?: CashOperationType;

  @IsEnum(PaymentMethodType)
  @IsOptional()
  paymentMethod?: PaymentMethodType;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}
