import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateServiceReceiptDetailDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsOptional()
  role?: string;
}
