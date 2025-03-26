import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
} from 'class-validator';
import {
  TransactionType,
  ReferenceType,
} from '../../entities/payment-method-transaction.entity';

export class CreatePaymentMethodTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  paymentMethodId: string;

  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  transactionType: TransactionType;

  @IsEnum(ReferenceType)
  @IsOptional()
  referenceType?: ReferenceType;

  @IsUUID()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
