import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { LabelType, LabelSize } from './label-template.dto';

export class CreateTemplateDto {
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

  @IsUUID()
  shopId: string;
}
