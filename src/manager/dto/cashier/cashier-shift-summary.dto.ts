import { CashShiftStatus } from '../../entities/cash-shift.entity';

export class CashierShiftSummaryDto {
  id: string;
  cashRegisterId: string;
  cashRegisterName?: string;
  startTime: Date;
  endTime?: Date;
  initialAmount: number;
  finalAmount?: number;
  status: CashShiftStatus;
  salesCount: number;
  servicesCount: number;
  totalSalesAmount?: number;
  totalServicesAmount?: number;
  totalAmount?: number;
  cashAmount?: number;
  cardAmount?: number;
  qrAmount?: number;

  // Дополнительные поля
  totalIncome?: number;
  cashIncome?: number;
  cardIncome?: number;
  qrIncome?: number;
  cashWithdraws?: number;
  cashDeposits?: number;
  returnsCount?: number;
  notes?: string;

  // Связанные сущности
  openedBy?: {
    id: string;
    name: string;
  };

  closedBy?: {
    id: string;
    name: string;
  } | null;

  cashRegister?: {
    id: string;
    name: string;
  };
}
