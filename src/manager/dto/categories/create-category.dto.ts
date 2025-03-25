import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
