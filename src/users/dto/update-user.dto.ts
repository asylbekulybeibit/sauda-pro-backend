import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsEmail(undefined, { message: 'Некорректный формат email' })
  email?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isSuperAdmin?: boolean;
}
