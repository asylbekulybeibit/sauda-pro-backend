import { IsNotEmpty, IsNumber, IsUUID, IsString, Min } from 'class-validator';

export class CashierCompleteServiceDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @IsNumber()
  @Min(0)
  finalPrice: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}
