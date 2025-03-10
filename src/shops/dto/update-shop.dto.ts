import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ShopType } from '../entities/shop.entity';

export class UpdateShopDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(ShopType)
  @IsOptional()
  type?: ShopType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
