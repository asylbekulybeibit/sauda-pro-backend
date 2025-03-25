import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class TransferItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CreateTransferDto {
  @IsUUID()
  fromWarehouseId: string;

  @IsUUID()
  toWarehouseId: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @IsString()
  @IsOptional()
  comment?: string;
}
