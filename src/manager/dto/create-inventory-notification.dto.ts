import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateInventoryNotificationDto {
  @IsUUID()
  warehouseProductId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  minQuantity: number;

  @IsArray()
  @IsString({ each: true })
  notifyVia: string[];

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
