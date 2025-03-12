import { IsString, IsNumber, IsOptional, Min, IsUUID } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsUUID()
  shopId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
