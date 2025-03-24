import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { SalesReceiptStatus } from '../../entities/sales-receipt.entity';

export class UpdateSalesReceiptDto {
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  finalAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsEnum(SalesReceiptStatus)
  @IsOptional()
  status?: SalesReceiptStatus;

  @IsUUID()
  @IsOptional()
  cashOperationId?: string;
}
