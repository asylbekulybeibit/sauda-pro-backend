import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ServiceStatus } from '../../entities/service.entity';

export class CreateServiceDto {
  @IsUUID()
  @IsNotEmpty()
  shopId: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

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

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
