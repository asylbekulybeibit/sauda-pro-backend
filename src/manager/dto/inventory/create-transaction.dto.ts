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
  IsEnum,
} from 'class-validator';

// Тип транзакции
export enum TransactionType {
  PURCHASE = 'PURCHASE', // Приход товара
  SALE = 'SALE', // Продажа
  ADJUSTMENT = 'ADJUSTMENT', // Корректировка (инвентаризация)
  WRITE_OFF = 'WRITE_OFF', // Списание
  TRANSFER = 'TRANSFER', // Перемещение между складами
  RETURN = 'RETURN', // Возврат товара
}

// Метаданные для разных типов транзакций
export class TransactionMetadata {
  @IsUUID()
  @IsOptional()
  toWarehouseId?: string; // Для перемещений

  @IsUUID()
  @IsOptional()
  supplierId?: string; // Для приходов

  @IsString()
  @IsOptional()
  invoiceNumber?: string; // Для приходов

  @IsString()
  @IsOptional()
  serialNumber?: string; // Для товаров с серийными номерами

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date; // Для товаров с сроком годности

  @IsNumber()
  @IsOptional()
  currentQuantity?: number; // Для инвентаризации

  @IsNumber()
  @IsOptional()
  difference?: number; // Для инвентаризации

  @IsBoolean()
  @IsOptional()
  updatePrices?: boolean; // Для обновления цен продажи

  @IsBoolean()
  @IsOptional()
  updatePurchasePrices?: boolean; // Для обновления закупочных цен
}

// Базовый DTO для всех транзакций
export class CreateTransactionDto {
  @IsUUID()
  warehouseId: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsUUID()
  warehouseProductId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionMetadata)
  metadata?: TransactionMetadata;
}

// DTO для приходов товара (оставляем для обратной совместимости)
export class PurchaseItemDto {
  @IsUUID()
  warehouseProductId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  recommendedPrice?: number;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date;

  @IsBoolean()
  @IsOptional()
  needsLabels?: boolean;

  @IsNumber()
  @IsOptional()
  partialQuantity?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CreatePurchaseDto {
  @IsUUID()
  warehouseId: string;

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
}
