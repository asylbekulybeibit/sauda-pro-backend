import {
  IsString,
  IsEnum,
  IsNumber,
  IsDate,
  IsUUID,
  IsOptional,
  IsArray,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PromotionType,
  PromotionTarget,
} from '../../entities/promotion.entity';

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionType)
  type: PromotionType;

  @IsEnum(PromotionTarget)
  target: PromotionTarget;

  @IsNumber()
  @Min(0)
  value: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.target === PromotionTarget.CART)
  minCartAmount?: number;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ValidateIf((o) => o.target === PromotionTarget.PRODUCT)
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ValidateIf((o) => o.target === PromotionTarget.CATEGORY)
  categoryIds?: string[];
}
