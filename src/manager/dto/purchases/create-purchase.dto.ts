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
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
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
  @Transform(({ value }) => {
    // Принудительное преобразование к числу
    if (typeof value === 'string') {
      const numValue = Number(value.replace(/[^0-9.-]+/g, ''));
      return isNaN(numValue) ? 0 : numValue;
    }
    return typeof value === 'number' && !isNaN(value) ? value : 0;
  })
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

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => {
    // Принудительное преобразование к числу
    if (typeof value === 'string') {
      const numValue = Number(value.replace(/[^0-9.-]+/g, ''));
      return isNaN(numValue) ? 0 : numValue;
    }
    return typeof value === 'number' && !isNaN(value) ? value : 0;
  })
  price?: number;

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
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsOptional()
  @IsBoolean()
  updatePurchasePrices?: boolean;

  @IsOptional()
  @IsBoolean()
  createLabels?: boolean;

  @IsOptional()
  @IsBoolean()
  checkDuplicates?: boolean;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'completed' | 'cancelled';

  createdById?: string;
}

// DTO для редактирования черновика
export class UpdatePurchaseDto {
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

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

  @IsBoolean()
  @IsOptional()
  checkDuplicates?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  markup?: number;

  @IsString()
  @IsOptional()
  markupType?: 'percentage' | 'fixed';

  @IsEnum(PurchaseStatus)
  @IsOptional()
  status?: PurchaseStatus;
}
