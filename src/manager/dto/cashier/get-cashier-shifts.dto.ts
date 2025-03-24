import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { CashShiftStatus } from '../../entities/cash-shift.entity';

export class GetCashierShiftsDto {
  @IsEnum(CashShiftStatus)
  @IsOptional()
  status?: CashShiftStatus;

  @IsDateString()
  @IsOptional()
  startDateFrom?: string;

  @IsDateString()
  @IsOptional()
  startDateTo?: string;
}
