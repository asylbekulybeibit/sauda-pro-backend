import {
  IsEnum,
  IsNumber,
  IsString,
  IsUUID,
  IsOptional,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../../entities/inventory-transaction.entity';

export class TransferMetadata {
  @IsUUID()
  targetShopId: string;

  @IsOptional()
  @IsUUID()
  transferId?: string;
}

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  shopId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransferMetadata)
  metadata?: TransferMetadata;
}
