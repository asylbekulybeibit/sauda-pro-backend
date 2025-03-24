import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateCashShiftDto {
  @IsUUID()
  @IsNotEmpty()
  cashRegisterId: string;

  @IsNumber()
  @Min(0)
  initialAmount: number;
}
