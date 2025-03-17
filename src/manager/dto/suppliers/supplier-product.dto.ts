import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class SupplierProductDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  minimumOrder?: number;
}
