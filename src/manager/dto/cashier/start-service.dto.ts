import { IsNotEmpty, IsUUID, IsArray } from 'class-validator';

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
}
