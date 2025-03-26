import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  PaymentMethodTransaction,
  TransactionType,
  ReferenceType,
} from '../entities/payment-method-transaction.entity';
import { RegisterPaymentMethod } from '../entities/register-payment-method.entity';
import { CreatePaymentMethodTransactionDto } from '../dto/payment-method-transactions/create-transaction.dto';

@Injectable()
export class PaymentMethodTransactionsService {
  constructor(
    @InjectRepository(PaymentMethodTransaction)
    private readonly transactionRepository: Repository<PaymentMethodTransaction>,
    @InjectRepository(RegisterPaymentMethod)
    private readonly paymentMethodRepository: Repository<RegisterPaymentMethod>
  ) {}

  async create(
    createDto: CreatePaymentMethodTransactionDto,
    userId: string
  ): Promise<PaymentMethodTransaction> {
    // Найти метод оплаты
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: createDto.paymentMethodId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Метод оплаты не найден');
    }

    // Преобразуем значения в числа, чтобы избежать проблем с типами
    const currentBalance = Number(paymentMethod.currentBalance || 0);
    const transactionAmount = Number(createDto.amount);

    const balanceBefore = currentBalance;
    const balanceAfter = balanceBefore + transactionAmount;

    // Создаем транзакцию
    const transaction = this.transactionRepository.create({
      paymentMethodId: createDto.paymentMethodId,
      shiftId: createDto.shiftId,
      amount: transactionAmount,
      balanceBefore,
      balanceAfter,
      transactionType: createDto.transactionType,
      referenceType: createDto.referenceType,
      referenceId: createDto.referenceId,
      note: createDto.note,
      createdById: userId,
    });

    // Обновляем баланс метода оплаты
    paymentMethod.currentBalance = balanceAfter;
    await this.paymentMethodRepository.save(paymentMethod);

    // Сохраняем транзакцию
    return this.transactionRepository.save(transaction);
  }

  async findAllByPaymentMethod(
    paymentMethodId: string,
    startDate?: Date,
    endDate?: Date,
    transactionType?: TransactionType,
    limit: number = 100,
    offset: number = 0
  ): Promise<PaymentMethodTransaction[]> {
    // Проверяем, существует ли такой метод оплаты
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Метод оплаты не найден');
    }

    // Строим условия для запроса
    const whereConditions: any = { paymentMethodId };

    if (startDate && endDate) {
      whereConditions.createdAt = Between(startDate, endDate);
    }

    if (transactionType) {
      whereConditions.transactionType = transactionType;
    }

    // Получаем транзакции
    const transactions = await this.transactionRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['createdBy'],
    });

    return transactions;
  }

  async deposit(
    paymentMethodId: string,
    amount: number,
    note: string,
    userId: string,
    shiftId?: string
  ): Promise<PaymentMethodTransaction> {
    // Убедимся, что amount - это число
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException(
        'Сумма пополнения должна быть положительной'
      );
    }

    return this.create(
      {
        paymentMethodId,
        shiftId,
        amount: numericAmount,
        transactionType: TransactionType.DEPOSIT,
        referenceType: ReferenceType.MANUAL,
        note: note || 'Пополнение баланса',
      },
      userId
    );
  }

  async withdraw(
    paymentMethodId: string,
    amount: number,
    note: string,
    userId: string,
    shiftId?: string
  ): Promise<PaymentMethodTransaction> {
    // Убедимся, что amount - это число
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Сумма изъятия должна быть положительной');
    }

    // Проверяем, достаточно ли средств
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Метод оплаты не найден');
    }

    // Преобразуем текущий баланс в число
    const currentBalance = Number(paymentMethod.currentBalance || 0);

    if (currentBalance < numericAmount) {
      throw new BadRequestException('Недостаточно средств для изъятия');
    }

    return this.create(
      {
        paymentMethodId,
        shiftId,
        amount: -numericAmount, // отрицательная сумма для изъятия
        transactionType: TransactionType.WITHDRAWAL,
        referenceType: ReferenceType.MANUAL,
        note: note || 'Изъятие средств',
      },
      userId
    );
  }

  async recordSalePayment(
    paymentMethodId: string,
    amount: number,
    saleId: string,
    userId: string,
    shiftId: string,
    note?: string
  ): Promise<PaymentMethodTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Сумма продажи должна быть положительной');
    }

    return this.create(
      {
        paymentMethodId,
        shiftId,
        amount,
        transactionType: TransactionType.SALE,
        referenceType: ReferenceType.SALE,
        referenceId: saleId,
        note: note || `Продажа #${saleId}`,
      },
      userId
    );
  }

  async recordRefund(
    paymentMethodId: string,
    amount: number,
    refundId: string,
    userId: string,
    shiftId: string,
    note?: string
  ): Promise<PaymentMethodTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Сумма возврата должна быть положительной');
    }

    return this.create(
      {
        paymentMethodId,
        shiftId,
        amount: -amount, // отрицательная сумма для возврата
        transactionType: TransactionType.REFUND,
        referenceType: ReferenceType.REFUND,
        referenceId: refundId,
        note: note || `Возврат #${refundId}`,
      },
      userId
    );
  }

  async recordPurchasePayment(
    paymentMethodId: string,
    amount: number,
    purchaseId: string,
    userId: string,
    shiftId: string,
    note?: string
  ): Promise<PaymentMethodTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Сумма закупки должна быть положительной');
    }

    return this.create(
      {
        paymentMethodId,
        shiftId,
        amount: -amount, // отрицательная сумма для закупки
        transactionType: TransactionType.PURCHASE,
        referenceType: ReferenceType.PURCHASE,
        referenceId: purchaseId,
        note: note || `Закупка #${purchaseId}`,
      },
      userId
    );
  }
}
