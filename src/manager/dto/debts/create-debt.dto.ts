import {
  IsString,
  IsNumber,
  IsDate,
  IsEnum,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DebtType, DebtStatus } from '../../entities/debt.entity';

export class CreateDebtDto {
  @IsUUID()
  warehouseId: string;

  @IsEnum(DebtType)
  type: DebtType;

  @IsOptional()
  @IsEnum(DebtStatus)
  status?: DebtStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
