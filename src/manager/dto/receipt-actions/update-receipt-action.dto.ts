import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ReceiptActionStatus } from '../../entities/receipt-action.entity';

export class UpdateReceiptActionDto {
  @IsEnum(ReceiptActionStatus)
  @IsOptional()
  status?: ReceiptActionStatus;

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}
