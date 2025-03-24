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
import { ServiceReceiptStatus } from '../../entities/service-receipt.entity';
import { CreateServiceReceiptDetailDto } from '../service-receipts/create-service-receipt-detail.dto';

export class CreateServiceReceiptDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @IsUUID()
  @IsNotEmpty()
  cashShiftId: string;

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

  @IsEnum(ServiceReceiptStatus)
  @IsOptional()
  status?: ServiceReceiptStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceReceiptDetailDto)
  details: CreateServiceReceiptDetailDto[];
}
