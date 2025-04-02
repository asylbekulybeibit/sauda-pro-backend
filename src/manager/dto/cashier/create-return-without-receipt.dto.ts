import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnWithoutReceiptItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateReturnWithoutReceiptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnWithoutReceiptItemDto)
  items: ReturnWithoutReceiptItemDto[];

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsUUID()
  @IsNotEmpty()
  paymentMethodId: string;
}
