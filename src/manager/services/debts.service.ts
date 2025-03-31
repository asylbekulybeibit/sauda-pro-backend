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
    return this.debtRepository.find({
      where: { warehouseId, isActive: true },
      relations: ['supplier', 'purchase', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
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
    payment: {
      paymentMethodId: string;
      amount: number;
      note?: string;
    },
    userId: string
  ): Promise<Debt> {
    const debt = await this.findOne(debtId);

    if (payment.amount <= 0) {
      throw new BadRequestException('Сумма оплаты должна быть больше 0');
    }

    if (payment.amount > debt.remainingAmount) {
      throw new BadRequestException('Сумма оплаты превышает оставшуюся сумму');
    }

    // Создаем транзакцию оплаты
    await this.paymentMethodTransactionsService.recordDebtPayment(
      payment.paymentMethodId,
      payment.amount,
      debt.id,
      userId,
      debt.type === DebtType.PAYABLE ? 'outgoing' : 'incoming',
      payment.note
    );

    // Обновляем информацию о долге
    debt.paidAmount += payment.amount;
    debt.remainingAmount = debt.totalAmount - debt.paidAmount;

    // Обновляем статус долга
    if (debt.remainingAmount === 0) {
      debt.status = DebtStatus.PAID;
    } else if (debt.paidAmount > 0) {
      debt.status = DebtStatus.PARTIALLY_PAID;
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
    return this.debtRepository.find({
      where: {
        warehouseId,
        isActive: true,
        status: DebtStatus.ACTIVE,
      },
      relations: ['supplier', 'purchase', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDebtsStatistics(warehouseId: string) {
    const debts = await this.debtRepository.find({
      where: { warehouseId, isActive: true },
    });

    return {
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
