import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDate,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { PurchaseStatus } from '../../entities/purchase.entity';

export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsNumber()
  @IsOptional()
  partialQuantity?: number;
}

export class CreatePurchaseDto {
  @IsUUID()
  shopId: string;

  @IsUUID()
  supplierId: string;

  @IsString()
  invoiceNumber: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsBoolean()
  @IsOptional()
  updatePrices?: boolean;

  @IsBoolean()
  @IsOptional()
  updatePurchasePrices?: boolean;

  @IsBoolean()
  @IsOptional()
  createLabels?: boolean;

  @IsString()
  @IsOptional()
  status?: PurchaseStatus;
}
