import {
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
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
  barcodeId?: string;

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

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
