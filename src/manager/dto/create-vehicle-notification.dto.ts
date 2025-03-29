import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateVehicleNotificationDto {
  @IsString()
  serviceType: string;

  @IsNumber()
  mileageInterval: number;

  @IsNumber()
  monthsInterval: number;

  @IsArray()
  @IsString({ each: true })
  notifyVia: string[];

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
