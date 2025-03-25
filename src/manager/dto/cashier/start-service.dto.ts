import {
  IsNotEmpty,
  IsUUID,
  IsArray,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CashierStartServiceDto {
  @IsUUID()
  @IsNotEmpty()
  serviceTypeId: string;

  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  staffIds: string[];

  @IsNumber()
  @IsOptional()
  originalPrice?: number;

  @IsNumber()
  @IsOptional()
  finalPrice?: number;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsOptional()
  comment?: string;
}
