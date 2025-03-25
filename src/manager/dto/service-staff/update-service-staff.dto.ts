import { IsUUID, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceStaffDto {
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsUUID()
  @IsOptional()
  shopId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  startedWork?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  completedWork?: Date;
}
