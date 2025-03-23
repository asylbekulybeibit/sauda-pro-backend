import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateVehicleDto {
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  make: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  @Min(1900)
  year?: number;

  @IsString()
  @IsNotEmpty()
  bodyType: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  engineVolume?: number;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsString()
  @IsOptional()
  vin?: string;
}
