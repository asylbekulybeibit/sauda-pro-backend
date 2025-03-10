import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ShopType } from '../entities/shop.entity';

export class CreateShopDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(ShopType)
  type: ShopType;
}
