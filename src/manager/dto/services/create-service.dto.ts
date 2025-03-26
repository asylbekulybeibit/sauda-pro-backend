import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ServiceStatus } from '../../entities/service.entity';

export class CreateServiceDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsUUID()
  @IsNotEmpty()
  shopId: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @IsUUID()
  @IsNotEmpty()
  barcodeId: string;

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

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  price: number;
}
