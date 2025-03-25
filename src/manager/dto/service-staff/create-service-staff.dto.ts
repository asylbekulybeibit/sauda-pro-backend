import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateServiceStaffDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsUUID()
  @IsNotEmpty()
  shopId: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;
}
