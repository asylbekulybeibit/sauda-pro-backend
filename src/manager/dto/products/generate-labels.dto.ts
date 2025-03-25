import {
  IsUUID,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductLabelDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class GenerateLabelsDto {
  @IsUUID()
  warehouseId: string;

  @IsString()
  templateId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductLabelDto)
  products: ProductLabelDto[];
}
