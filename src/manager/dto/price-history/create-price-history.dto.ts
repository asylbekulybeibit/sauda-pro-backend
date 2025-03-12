import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreatePriceHistoryDto {
  @IsNumber()
  @Min(0)
  oldPrice: number;

  @IsNumber()
  @Min(0)
  newPrice: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsUUID()
  productId: string;
}
