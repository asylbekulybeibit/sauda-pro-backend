import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateShopDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
