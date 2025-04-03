import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReturnItemDto {
  @IsString()
  @IsNotEmpty()
  receiptItemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CreateReturnDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
