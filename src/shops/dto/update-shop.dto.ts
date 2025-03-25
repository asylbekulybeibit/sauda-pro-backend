import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';

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

 

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
