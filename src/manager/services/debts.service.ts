import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Debt, DebtStatus, DebtType } from '../entities/debt.entity';
import { CreateDebtDto } from '../dto/debts/create-debt.dto';
import { Purchase } from '../entities/purchase.entity';
import { PaymentMethodTransactionsService } from './payment-method-transactions.service';

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    private readonly paymentMethodTransactionsService: PaymentMethodTransactionsService
  ) {}

  async create(userId: string, createDebtDto: CreateDebtDto): Promise<Debt> {
    const debt = this.debtRepository.create({
      ...createDebtDto,
      createdById: userId,
      remainingAmount:
        createDebtDto.totalAmount - (createDebtDto.paidAmount || 0),
      status:
        createDebtDto.paidAmount && createDebtDto.paidAmount > 0
          ? DebtStatus.PARTIALLY_PAID
          : DebtStatus.ACTIVE,
    });

    // Если долг связан с приходом, проверяем его существование
    if (createDebtDto.purchaseId) {
      const purchase = await this.purchaseRepository.findOne({
        where: { id: createDebtDto.purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException('Приход не найден');
      }
    }

    return this.debtRepository.save(debt);
  }

  async findAll(warehouseId: string): Promise<Debt[]> {
    console.log('[DebtsService] Finding all debts for warehouse:', warehouseId);
    try {
      const debts = await this.debtRepository.find({
        where: { warehouseId, isActive: true },
        relations: ['supplier', 'purchase', 'createdBy'],
        order: { createdAt: 'DESC' },
      });
      console.log('[DebtsService] Found debts:', debts.length);
      return debts;
    } catch (error) {
      console.error('[DebtsService] Error finding debts:', error);
      throw error;
    }
  }

  async findOne(id: string): Promise<Debt> {
    const debt = await this.debtRepository.findOne({
      where: { id },
      relations: ['supplier', 'purchase', 'createdBy'],
    });

    if (!debt) {
      throw new NotFoundException('Долг не найден');
    }

    return debt;
  }

  async addPayment(
    debtId: string,
    paymentMethodId: string,
    amount: number,
    userId: string
  ) {
    const debt = await this.debtRepository.findOne({
      where: { id: debtId },
      relations: ['purchase'],
    });

    if (!debt) {
      throw new NotFoundException('Долг не найден');
    }

    if (amount <= 0) {
      throw new BadRequestException('Сумма оплаты должна быть больше 0');
    }

    if (amount > debt.remainingAmount) {
      throw new BadRequestException('Сумма оплаты превышает остаток долга');
    }

    // Если долг связан с приходом, используем тип транзакции 'purchase'
    if (debt.purchase) {
      await this.paymentMethodTransactionsService.recordPurchasePayment(
        paymentMethodId,
        amount,
        debt.purchase.id,
        userId,
        null
      );
    } else {
      // Для остальных долгов используем обычную запись долга
      await this.paymentMethodTransactionsService.recordDebtPayment(
        paymentMethodId,
        amount,
        debtId,
        userId,
        debt.type === DebtType.PAYABLE ? 'outgoing' : 'incoming'
      );
    }

    // Обновляем сумму оплаты и остаток
    debt.paidAmount = Number(debt.paidAmount) + amount;
    debt.remainingAmount = Number(debt.totalAmount) - Number(debt.paidAmount);

    // Обновляем статус долга
    if (debt.remainingAmount === 0) {
      debt.status = DebtStatus.PAID;
    } else if (debt.paidAmount > 0) {
      debt.status = DebtStatus.PARTIALLY_PAID;
    }

    // Если долг связан с приходом, обновляем информацию об оплате в приходе
    if (debt.purchase) {
      debt.purchase.paidAmount = Number(debt.purchase.paidAmount) + amount;
      debt.purchase.remainingAmount =
        Number(debt.purchase.totalAmount) - Number(debt.purchase.paidAmount);
      await this.purchaseRepository.save(debt.purchase);
    }

    return this.debtRepository.save(debt);
  }

  async cancel(id: string): Promise<Debt> {
    const debt = await this.findOne(id);
    debt.status = DebtStatus.CANCELLED;
    return this.debtRepository.save(debt);
  }

  async getDebtsBySupplier(supplierId: string): Promise<Debt[]> {
    return this.debtRepository.find({
      where: { supplierId, isActive: true },
      relations: ['supplier', 'purchase', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveDebts(warehouseId: string): Promise<Debt[]> {
    console.log(
      '[DebtsService] Getting active debts for warehouse:',
      warehouseId
    );
    try {
      const debts = await this.debtRepository.find({
        where: {
          warehouseId,
          isActive: true,
          status: DebtStatus.ACTIVE,
        },
        relations: ['supplier', 'purchase', 'createdBy'],
        order: { createdAt: 'DESC' },
      });
      console.log('[DebtsService] Found active debts:', debts.length);
      return debts;
    } catch (error) {
      console.error('[DebtsService] Error getting active debts:', error);
      throw error;
    }
  }

  async getDebtsStatistics(warehouseId: string) {
    console.log(
      '[DebtsService] Getting statistics for warehouse:',
      warehouseId
    );
    try {
      const debts = await this.debtRepository.find({
        where: { warehouseId, isActive: true },
      });
      const stats = {
        totalPayable: debts
          .filter((debt) => debt.type === DebtType.PAYABLE)
          .reduce((sum, debt) => sum + debt.remainingAmount, 0),
        totalReceivable: debts
          .filter((debt) => debt.type === DebtType.RECEIVABLE)
          .reduce((sum, debt) => sum + debt.remainingAmount, 0),
        activeDebtsCount: debts.filter(
          (debt) => debt.status === DebtStatus.ACTIVE
        ).length,
        partiallyPaidCount: debts.filter(
          (debt) => debt.status === DebtStatus.PARTIALLY_PAID
        ).length,
        paidDebtsCount: debts.filter((debt) => debt.status === DebtStatus.PAID)
          .length,
      };
      console.log('[DebtsService] Calculated statistics:', stats);
      return stats;
    } catch (error) {
      console.error('[DebtsService] Error getting statistics:', error);
      throw error;
    }
  }

  async findByPurchaseId(purchaseId: string): Promise<Debt | null> {
    return this.debtRepository.findOne({
      where: { purchaseId, isActive: true },
      relations: ['supplier', 'purchase', 'createdBy'],
    });
  }

  async update(id: string, updateData: Partial<Debt>): Promise<Debt> {
    const debt = await this.findOne(id);

    if (!debt) {
      throw new NotFoundException('Долг не найден');
    }

    // Обновляем поля
    Object.assign(debt, {
      ...updateData,
      remainingAmount:
        Number(updateData.totalAmount || debt.totalAmount) -
        Number(updateData.paidAmount || debt.paidAmount),
    });

    // Обновляем статус долга
    if (debt.remainingAmount === 0) {
      debt.status = DebtStatus.PAID;
    } else if (debt.paidAmount > 0) {
      debt.status = DebtStatus.PARTIALLY_PAID;
    }

    return this.debtRepository.save(debt);
  }
}
