import {
  IsString,
  IsNumber,
  IsDate,
  IsArray,
  ValidateNested,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  currentQuantity: number;

  @IsNumber()
  actualQuantity: number;

  @IsNumber()
  difference: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CreateInventoryDto {
  @IsString()
  shopId: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryItemDto)
  items: InventoryItemDto[];
}
