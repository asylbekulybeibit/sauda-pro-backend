import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetSalesHistoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false, enum: ['sale', 'return'] })
  @IsOptional()
  @IsEnum(['sale', 'return'] as const)
  receiptType?: 'sale' | 'return';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cashierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
