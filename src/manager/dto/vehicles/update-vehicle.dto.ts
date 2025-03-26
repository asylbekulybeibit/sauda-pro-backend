import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class UpdateVehicleDto {
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  make?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  @Min(1900)
  year?: number;

  @IsString()
  @IsOptional()
  bodyType?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  engineVolume?: number;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsString()
  @IsOptional()
  vin?: string;

  @IsString()
  @IsOptional()
  registrationCertificate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
