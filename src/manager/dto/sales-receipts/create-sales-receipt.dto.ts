import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalesReceiptStatus } from '../../entities/sales-receipt.entity';
import { CreateSalesReceiptItemDto } from '../sales-receipts/create-sales-receipt-item.dto';

export class CreateSalesReceiptDto {
  @IsUUID()
  @IsNotEmpty()
  cashShiftId: string;

  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  finalAmount: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsString()
  @IsNotEmpty()
  receiptNumber: string;

  @IsEnum(SalesReceiptStatus)
  @IsOptional()
  status?: SalesReceiptStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReceiptItemDto)
  items: CreateSalesReceiptItemDto[];
}
