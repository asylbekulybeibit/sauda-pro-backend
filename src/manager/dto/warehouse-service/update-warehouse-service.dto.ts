import { IsOptional, IsUUID, IsNumber, IsBoolean, Min } from 'class-validator';

export class UpdateWarehouseServiceDto {
  @IsUUID()
  @IsOptional()
  barcodeId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
