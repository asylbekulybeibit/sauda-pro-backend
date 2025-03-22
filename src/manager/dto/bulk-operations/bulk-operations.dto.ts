import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkProductItemDto {
  @ApiProperty({ description: 'Название товара' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Артикул товара (уникальный в рамках магазина)' })
  @IsString()
  sku: string;

  @ApiProperty({ description: 'Цена товара' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Количество товара' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Категория товара', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Описание товара', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export enum BulkOperationType {
  CREATE = 'create',
  UPDATE = 'update',
}

export class BulkProductOperationDto {
  @ApiProperty({
    enum: BulkOperationType,
    description: 'Тип операции: create или update',
  })
  @IsEnum(BulkOperationType)
  operation: BulkOperationType;

  @ApiProperty({
    type: [BulkProductItemDto],
    description: 'Массив товаров для обработки',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProductItemDto)
  products: BulkProductItemDto[];
}

export class BulkOperationErrorDto {
  @ApiProperty({ description: 'Индекс товара в списке' })
  index: number;

  @ApiProperty({ description: 'Артикул товара' })
  sku: string;

  @ApiProperty({ description: 'Сообщение об ошибке' })
  message: string;
}

export class BulkOperationResultDto {
  @ApiProperty({ description: 'Успешно ли выполнена операция' })
  success: boolean;

  @ApiProperty({ description: 'Количество успешно обработанных товаров' })
  processed: number;

  @ApiProperty({ description: 'Количество товаров с ошибками' })
  failed: number;

  @ApiProperty({
    type: [BulkOperationErrorDto],
    description: 'Информация об ошибках',
  })
  errors: BulkOperationErrorDto[];
}
