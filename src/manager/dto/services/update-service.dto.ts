import { IsOptional, IsString, IsUUID, IsArray, IsEnum } from 'class-validator';
import { ServiceStatus } from '../../entities/service.entity';

export class UpdateServiceDto {
  @IsUUID()
  @IsOptional()
  shopId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  serviceTypeId?: string;

  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  staffIds?: string[];

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
