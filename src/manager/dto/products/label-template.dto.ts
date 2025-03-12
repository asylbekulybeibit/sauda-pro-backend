import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

export enum LabelType {
  PRICE_TAG = 'price_tag', // Ценник
  BARCODE = 'barcode', // Этикетка со штрих-кодом
  INFO = 'info', // Информационная этикетка
  SHELF = 'shelf', // Полочный ценник
}

export enum LabelSize {
  SMALL = 'small', // 58x40 мм
  MEDIUM = 'medium', // 58x60 мм
  LARGE = 'large', // 58x80 мм
  CUSTOM = 'custom', // Пользовательский размер
}

export class LabelTemplateDto {
  @IsString()
  name: string;

  @IsEnum(LabelType)
  type: LabelType;

  @IsEnum(LabelSize)
  size: LabelSize;

  @IsObject()
  template: {
    width: number;
    height: number;
    elements: {
      type: 'text' | 'barcode' | 'qr' | 'image';
      x: number;
      y: number;
      value: string;
      style?: Record<string, any>;
    }[];
  };

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
