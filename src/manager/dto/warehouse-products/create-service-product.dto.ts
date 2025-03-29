import { IsUUID, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateServiceProductDto {
  @IsUUID()
  barcodeId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;
}
