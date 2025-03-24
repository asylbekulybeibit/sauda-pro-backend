import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  SalesReceipt,
  SalesReceiptStatus,
} from '../entities/sales-receipt.entity';
import { SalesReceiptItem } from '../entities/sales-receipt-item.entity';
import { CreateSalesReceiptDto } from '../dto/sales-receipts/create-sales-receipt.dto';
import { UpdateSalesReceiptDto } from '../dto/sales-receipts/update-sales-receipt.dto';
import {
  CashOperation,
  CashOperationType,
  PaymentMethodType,
} from '../entities/cash-operation.entity';
import { CashShift, CashShiftStatus } from '../entities/cash-shift.entity';
import { Product } from '../entities/product.entity';

@Injectable()
export class SalesReceiptsService {
  constructor(
    @InjectRepository(SalesReceipt)
    private readonly salesReceiptRepository: Repository<SalesReceipt>,
    @InjectRepository(SalesReceiptItem)
    private readonly salesReceiptItemRepository: Repository<SalesReceiptItem>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(CashShift)
    private readonly cashShiftRepository: Repository<CashShift>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) {}

  async create(
    createSalesReceiptDto: CreateSalesReceiptDto,
    shopId: string,
    cashierId: string
  ): Promise<SalesReceipt> {
    // Проверяем, существует ли смена
    const cashShift = await this.cashShiftRepository.findOne({
      where: { id: createSalesReceiptDto.cashShiftId, shopId },
    });

    if (!cashShift) {
      throw new NotFoundException(
        `Смена с ID ${createSalesReceiptDto.cashShiftId} не найдена`
      );
    }

    // Создаем чек
    const receipt = this.salesReceiptRepository.create({
      ...createSalesReceiptDto,
      shopId,
      cashierId,
      status: createSalesReceiptDto.status || SalesReceiptStatus.CREATED,
    });

    // Сохраняем чек
    const savedReceipt = await this.salesReceiptRepository.save(receipt);

    // Создаем позиции чека, если они есть
    if (createSalesReceiptDto.items && createSalesReceiptDto.items.length > 0) {
      // Создаем объекты SalesReceiptItem для каждой позиции
      const receiptItems = [];

      for (const item of createSalesReceiptDto.items) {
        const receiptItem = this.salesReceiptItemRepository.create({
          ...item,
          salesReceiptId: savedReceipt.id,
          shopId,
        });
        receiptItems.push(receiptItem);
      }

      // Сохраняем позиции чека
      await this.salesReceiptItemRepository.save(receiptItems);
    }

    // Если статус чека установлен как PAID, создаем кассовую операцию
    if (receipt.status === SalesReceiptStatus.PAID) {
      await this.createCashOperation(savedReceipt);
    }

    // Возвращаем созданный чек с позициями
    return this.findOne(savedReceipt.id, shopId);
  }

  async findAll(
    shopId: string,
    cashShiftId?: string,
    status?: string,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesReceipt[]> {
    const queryBuilder = this.salesReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.items', 'items')
      .leftJoinAndSelect('receipt.cashier', 'cashier')
      .leftJoinAndSelect('receipt.client', 'client')
      .leftJoinAndSelect('receipt.cashShift', 'cashShift')
      .where('receipt.shopId = :shopId', { shopId });

    if (cashShiftId) {
      queryBuilder.andWhere('receipt.cashShiftId = :cashShiftId', {
        cashShiftId,
      });
    }

    if (status) {
      queryBuilder.andWhere('receipt.status = :status', { status });
    }

    if (fromDate) {
      const from = new Date(fromDate);
      queryBuilder.andWhere('receipt.createdAt >= :fromDate', {
        fromDate: from,
      });
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('receipt.createdAt <= :toDate', { toDate: to });
    }

    queryBuilder.orderBy('receipt.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, shopId: string): Promise<SalesReceipt> {
    const receipt = await this.salesReceiptRepository.findOne({
      where: { id, shopId },
      relations: ['items', 'cashier', 'client', 'cashShift', 'cashOperation'],
    });

    if (!receipt) {
      throw new NotFoundException('Чек не найден');
    }

    return receipt;
  }

  async update(
    id: string,
    updateSalesReceiptDto: UpdateSalesReceiptDto,
    shopId: string
  ): Promise<SalesReceipt> {
    const receipt = await this.findOne(id, shopId);

    // Запрещаем изменение статуса чека в определенных случаях
    if (
      updateSalesReceiptDto.status &&
      receipt.status !== SalesReceiptStatus.CREATED &&
      receipt.status !== updateSalesReceiptDto.status
    ) {
      throw new BadRequestException(
        `Невозможно изменить статус чека из ${receipt.status} в ${updateSalesReceiptDto.status}`
      );
    }

    // Обновляем поля чека
    Object.assign(receipt, updateSalesReceiptDto);

    // Сохраняем обновленный чек
    const updatedReceipt = await this.salesReceiptRepository.save(receipt);

    // Если статус чека изменен на PAID, создаем кассовую операцию
    if (
      updateSalesReceiptDto.status === SalesReceiptStatus.PAID &&
      !receipt.cashOperationId
    ) {
      await this.createCashOperation(updatedReceipt);
    }

    return this.findOne(id, shopId);
  }

  async cancel(id: string, shopId: string): Promise<SalesReceipt> {
    const receipt = await this.findOne(id, shopId);

    if (receipt.status !== SalesReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Можно отменить только чек в статусе "Создан"'
      );
    }

    receipt.status = SalesReceiptStatus.CANCELLED;
    return this.salesReceiptRepository.save(receipt);
  }

  async refund(id: string, shopId: string): Promise<SalesReceipt> {
    const receipt = await this.findOne(id, shopId);

    if (receipt.status !== SalesReceiptStatus.PAID) {
      throw new BadRequestException('Можно возвратить только оплаченный чек');
    }

    receipt.status = SalesReceiptStatus.REFUNDED;

    // Создаем операцию возврата
    if (receipt.cashOperationId) {
      const cashOperation = await this.cashOperationRepository.findOne({
        where: { id: receipt.cashOperationId },
      });

      if (cashOperation) {
        const refundOperation = this.cashOperationRepository.create({
          cashRegisterId: cashOperation.cashRegisterId,
          shiftId: cashOperation.shiftId,
          operationType: CashOperationType.RETURN,
          amount: cashOperation.amount,
          paymentMethod: cashOperation.paymentMethod,
        });

        await this.cashOperationRepository.save(refundOperation);
      }
    }

    return this.salesReceiptRepository.save(receipt);
  }

  private async createCashOperation(receipt: SalesReceipt): Promise<void> {
    let paymentMethodType: PaymentMethodType;

    // Маппинг методов оплаты из чека в типы операций
    switch (receipt.paymentMethod.toLowerCase()) {
      case 'cash':
        paymentMethodType = PaymentMethodType.CASH;
        break;
      case 'card':
        paymentMethodType = PaymentMethodType.CARD;
        break;
      case 'qr':
        paymentMethodType = PaymentMethodType.QR;
        break;
      default:
        paymentMethodType = PaymentMethodType.CASH;
    }

    // Найдем информацию о смене для получения cashRegisterId
    const cashShift = await this.cashShiftRepository.findOne({
      where: { id: receipt.cashShiftId },
    });

    if (!cashShift) {
      throw new NotFoundException('Кассовая смена не найдена');
    }

    // Создаем операцию
    const cashOperation = await this.cashOperationRepository.save({
      cashRegisterId: cashShift.cashRegisterId,
      shiftId: receipt.cashShiftId,
      operationType: CashOperationType.SALE,
      amount: receipt.finalAmount,
      paymentMethod: paymentMethodType,
      userId: receipt.cashierId,
      shopId: receipt.shopId,
    });

    // Привязываем операцию к чеку
    receipt.cashOperationId = cashOperation.id;
    await this.salesReceiptRepository.save(receipt);

    // Если метод оплаты - наличные, обновляем сумму в кассе
    if (paymentMethodType === PaymentMethodType.CASH) {
      cashShift.currentAmount += receipt.finalAmount;
      await this.cashShiftRepository.save(cashShift);
    }
  }
}
