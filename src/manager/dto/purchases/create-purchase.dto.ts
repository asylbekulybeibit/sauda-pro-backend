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

// DTO для создания нового прихода
export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
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

// DTO для редактирования элементов черновика
export class UpdatePurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  price?: number | null;

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

// DTO для создания нового прихода
export class CreatePurchaseDto {
  @IsUUID()
  @IsOptional()
  shopId: string;

  @IsUUID()
  @IsOptional()
  supplierId: string;

  @IsString()
  @IsOptional()
  invoiceNumber: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
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

  @IsUUID()
  @IsOptional()
  id?: string;
}

// DTO для редактирования черновика
export class UpdatePurchaseDto {
  @IsUUID()
  @IsOptional()
  shopId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date?: Date;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseItemDto)
  @IsOptional()
  items?: UpdatePurchaseItemDto[];

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
