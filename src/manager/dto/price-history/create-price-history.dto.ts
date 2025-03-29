import {
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { PriceType } from '../../entities/price-history.entity';

export class CreatePriceHistoryDto {
  @IsNumber()
  @Min(0)
  oldPrice: number;

  @IsNumber()
  @Min(0)
  newPrice: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  warehouseProductId: string;

  @IsEnum(PriceType)
  priceType: PriceType;
}
