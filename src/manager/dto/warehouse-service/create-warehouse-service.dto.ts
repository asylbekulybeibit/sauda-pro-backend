import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateWarehouseServiceDto {
  @IsUUID()
  @IsNotEmpty()
  barcodeId: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @IsNumber()
  @Min(0)
  price: number;
}
