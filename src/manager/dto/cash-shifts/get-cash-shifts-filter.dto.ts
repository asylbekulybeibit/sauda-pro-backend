import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { CashShiftStatus } from '../../entities/cash-shift.entity';

export class GetCashShiftsFilterDto {
  @IsUUID()
  @IsOptional()
  cashRegisterId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsEnum(CashShiftStatus)
  @IsOptional()
  status?: CashShiftStatus;

  @IsDateString()
  @IsOptional()
  startDateFrom?: string;

  @IsDateString()
  @IsOptional()
  startDateTo?: string;

  @IsDateString()
  @IsOptional()
  endDateFrom?: string;

  @IsDateString()
  @IsOptional()
  endDateTo?: string;
}
