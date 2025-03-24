import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import {
  ReceiptType,
  ReceiptActionType,
  ReceiptActionStatus,
} from '../../entities/receipt-action.entity';

export class CreateReceiptActionDto {
  @IsEnum(ReceiptType)
  @IsNotEmpty()
  receiptType: ReceiptType;

  @IsUUID()
  @IsNotEmpty()
  receiptId: string;

  @IsEnum(ReceiptActionType)
  @IsNotEmpty()
  actionType: ReceiptActionType;

  @IsEnum(ReceiptActionStatus)
  @IsOptional()
  status?: ReceiptActionStatus;

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}
