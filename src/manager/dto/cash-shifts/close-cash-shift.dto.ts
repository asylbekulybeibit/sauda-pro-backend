import { IsNumber, IsOptional, Min } from 'class-validator';

export class CloseCashShiftDto {
  @IsNumber()
  @Min(0)
  finalAmount: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cashAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cardAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  qrAmount?: number;
}
