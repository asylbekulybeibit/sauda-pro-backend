import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ServiceReceiptStatus } from '../../entities/service-receipt.entity';

export class UpdateServiceReceiptDto {
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

  @IsEnum(ServiceReceiptStatus)
  @IsOptional()
  status?: ServiceReceiptStatus;

  @IsUUID()
  @IsOptional()
  cashOperationId?: string;
}
