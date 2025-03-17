import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContactDto {
  @IsString()
  name: string;

  @IsString()
  position: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PaymentInfoDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  bankDetails?: string;

  @IsOptional()
  @IsString()
  terms?: string;
}

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentInfoDto)
  paymentInfo?: PaymentInfoDto;

  @IsUUID()
  shopId: string;
}
