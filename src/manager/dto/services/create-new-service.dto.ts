import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreateNewServiceDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsUUID()
  shopId: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  price: number;
}
