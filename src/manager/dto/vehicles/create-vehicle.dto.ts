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
  clientId: string;

  @IsString()
  @IsNotEmpty()
  make: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsNumber()
  @IsOptional()
  @Min(1900)
  year?: number;

  @IsString()
  @IsNotEmpty()
  bodyType: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  engineVolume: number;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsString()
  @IsOptional()
  vin?: string;
}
