import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, In, Not } from 'typeorm';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { CashShift, CashShiftStatus } from '../entities/cash-shift.entity';
import {
  Receipt,
  ReceiptStatus,
  PaymentMethod,
} from '../entities/receipt.entity';
import { ReceiptItem, ReceiptItemType } from '../entities/receipt-item.entity';
import { CashRegister } from '../entities/cash-register.entity';
import { Barcode } from '../entities/barcode.entity';
import { RegisterPaymentMethod } from '../entities/register-payment-method.entity';
import {
  CashOperation,
  CashOperationType,
  PaymentMethodType,
} from '../entities/cash-operation.entity';
import {
  PaymentMethodTransaction,
  TransactionType,
  ReferenceType,
} from '../entities/payment-method-transaction.entity';

@Injectable()
export class CashierService {
  constructor(
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>,
    @InjectRepository(CashShift)
    private readonly cashShiftRepository: Repository<CashShift>,
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptItem)
    private readonly receiptItemRepository: Repository<ReceiptItem>,
    @InjectRepository(RegisterPaymentMethod)
    private readonly paymentMethodRepository: Repository<RegisterPaymentMethod>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(PaymentMethodTransaction)
    private readonly paymentMethodTransactionRepository: Repository<PaymentMethodTransaction>
  ) {}

  /**
   * Поиск товаров по штрихкоду или названию
   */
  async searchProducts(warehouseId: string, query: string) {
    // Проверяем, является ли запрос числовым (для поиска по штрихкоду)
    const isNumeric = /^\d+$/.test(query);

    if (isNumeric) {
      // Ищем по частичному совпадению штрихкода
      const barcodes = await this.barcodeRepository.find({
        where: { code: Like(`%${query}%`) },
        relations: ['category'],
      });

      if (barcodes.length > 0) {
        // Если найдены штрихкоды, ищем соответствующие товары на складе
        const products = await this.warehouseProductRepository.find({
          where: {
            warehouseId,
            barcodeId: In(barcodes.map((b) => b.id)),
            isActive: true,
          },
          relations: ['barcode'],
        });

        if (products.length > 0) {
          return products.map((product) =>
            this.formatProductForResponse(
              product,
              barcodes.find((b) => b.id === product.barcodeId)!
            )
          );
        }
      }
    }

    // Если не нашли по штрихкоду или запрос не числовой, ищем по названию
    const products = await this.warehouseProductRepository.find({
      where: {
        warehouseId,
        isActive: true,
        barcode: {
          productName: ILike(`%${query}%`),
        },
      },
      relations: ['barcode', 'barcode.category'],
      take: 20, // Ограничим результаты
    });

    return products.map((product) =>
      this.formatProductForResponse(product, product.barcode)
    );
  }

  /**
   * Форматирование товара для ответа API
   */
  private formatProductForResponse(
    product: WarehouseProduct,
    barcode: Barcode
  ) {
    return {
      id: product.id,
      name: barcode.productName,
      code: barcode.code,
      description: barcode.description,
      category: barcode.category ? barcode.category.name : null,
      price: product.sellingPrice,
      quantity: product.quantity,
      isService: product.isService,
    };
  }

  /**
   * Получение информации о текущей смене
   */
  async getCurrentShift(warehouseId: string, userId: string) {
    console.log('[CashierService] Getting current shift:', {
      warehouseId,
      userId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Находим последнюю смену для данного склада и кассира
      const queryBuilder = this.cashShiftRepository
        .createQueryBuilder('shift')
        .leftJoinAndSelect('shift.cashRegister', 'cashRegister')
        .leftJoinAndSelect('shift.openedBy', 'openedBy')
        .where('cashRegister.warehouseId = :warehouseId', { warehouseId })
        .andWhere('shift.openedById = :userId', { userId })
        .orderBy('shift.startTime', 'DESC');

      console.log('[CashierService] Executing query:', queryBuilder.getSql());
      console.log('[CashierService] Query parameters:', {
        warehouseId,
        userId,
      });

      const shift = await queryBuilder.getOne();

      console.log('[CashierService] Found shift:', {
        shiftId: shift?.id,
        status: shift?.status,
        startTime: shift?.startTime,
        endTime: shift?.endTime,
        cashRegisterId: shift?.cashRegister?.id,
        openedById: shift?.openedBy?.id,
        rawStatus: shift?.status,
        isStatusOpen: shift?.status === CashShiftStatus.OPEN,
        expectedOpenStatus: CashShiftStatus.OPEN,
      });

      if (!shift) {
        console.log('[CashierService] No shift found');
        return null;
      }

      // Проверяем, является ли смена текущей (открытой)
      const isOpen = shift.status === CashShiftStatus.OPEN;
      console.log('[CashierService] Shift status check:', {
        isOpen,
        status: shift.status,
        statusType: typeof shift.status,
        expectedStatus: CashShiftStatus.OPEN,
        expectedStatusType: typeof CashShiftStatus.OPEN,
        areEqual: shift.status === CashShiftStatus.OPEN,
      });

      if (!isOpen) {
        console.log('[CashierService] Shift is not open');
        return null;
      }

      return {
        id: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        initialAmount: shift.initialAmount,
        currentAmount: shift.currentAmount,
        finalAmount: shift.finalAmount,
        status: shift.status.toUpperCase(),
        cashRegister: {
          id: shift.cashRegister.id,
          name: shift.cashRegister.name,
        },
        cashier: {
          id: shift.openedBy.id,
          name: `${shift.openedBy.firstName || ''} ${
            shift.openedBy.lastName || ''
          }`.trim(),
        },
      };
    } catch (error) {
      console.error('[CashierService] Error getting current shift:', error);
      throw error;
    }
  }

  /**
   * Открытие смены
   */
  async openShift(warehouseId: string, userId: string, openShiftDto: any) {
    // Проверяем, нет ли уже открытой смены
    const existingShift = await this.cashShiftRepository.findOne({
      where: {
        status: CashShiftStatus.OPEN,
        cashRegister: {
          id: openShiftDto.cashRegisterId,
          warehouseId,
        },
      },
    });

    if (existingShift) {
      throw new ConflictException('Уже есть открытая смена для этой кассы');
    }

    // Проверяем существование кассы
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: {
        id: openShiftDto.cashRegisterId,
        warehouseId,
      },
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!cashRegister) {
      throw new NotFoundException('Касса не найдена');
    }

    // Получаем shopId из связанного склада
    const shopId = cashRegister.warehouse?.shop?.id;

    if (!shopId) {
      throw new BadRequestException('Не найден магазин, связанный со складом');
    }

    // Создаем новую смену
    const newShift = this.cashShiftRepository.create({
      cashRegisterId: openShiftDto.cashRegisterId,
      openedById: userId,
      initialAmount: openShiftDto.initialAmount || 0,
      currentAmount: openShiftDto.initialAmount || 0,
      startTime: new Date(),
      status: CashShiftStatus.OPEN,
      shopId: shopId,
    });

    // Сохраняем связь с warehouse через cash register
    newShift.cashRegister = cashRegister;

    const savedShift = await this.cashShiftRepository.save(newShift);

    // Выполняем дополнительный запрос для получения информации о пользователе
    const shiftWithRelations = await this.cashShiftRepository.findOne({
      where: { id: savedShift.id },
      relations: ['cashRegister', 'openedBy'],
    });

    if (!shiftWithRelations) {
      throw new NotFoundException('Не удалось найти созданную смену');
    }

    return {
      id: savedShift.id,
      startTime: savedShift.startTime,
      initialAmount: savedShift.initialAmount,
      status: savedShift.status,
      cashRegister: {
        id: cashRegister.id,
        name: cashRegister.name,
      },
      cashier: {
        id: shiftWithRelations.openedBy.id,
        name: `${shiftWithRelations.openedBy.firstName || ''} ${
          shiftWithRelations.openedBy.lastName || ''
        }`.trim(),
      },
      currentAmount: savedShift.initialAmount,
    };
  }

  /**
   * Закрытие смены
   */
  async closeShift(warehouseId: string, userId: string, closeShiftDto: any) {
    // Находим открытую смену
    const shift = await this.cashShiftRepository.findOne({
      where: {
        id: closeShiftDto.shiftId,
        status: CashShiftStatus.OPEN,
        cashRegister: {
          warehouseId,
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Открытая смена не найдена');
    }

    // Обновляем смену
    shift.endTime = new Date();
    shift.closedById = userId;
    shift.finalAmount = closeShiftDto.finalAmount;
    shift.notes = closeShiftDto.notes;
    shift.status = CashShiftStatus.CLOSED;

    const savedShift = await this.cashShiftRepository.save(shift);

    return {
      id: savedShift.id,
      startTime: savedShift.startTime,
      endTime: savedShift.endTime,
      initialAmount: savedShift.initialAmount,
      finalAmount: savedShift.finalAmount,
      status: savedShift.status,
    };
  }

  /**
   * Создание нового чека
   */
  async createReceipt(
    warehouseId: string,
    userId: string,
    createReceiptDto: any
  ) {
    // Проверяем наличие открытой смены
    const shift = await this.cashShiftRepository.findOne({
      where: {
        id: createReceiptDto.cashShiftId,
        status: CashShiftStatus.OPEN,
        cashRegister: {
          warehouseId,
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Открытая смена не найдена');
    }

    // Проверяем существование кассы
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: {
        id: createReceiptDto.cashRegisterId,
        warehouseId,
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('Касса не найдена');
    }

    // Генерируем номер чека
    const receiptNumber = await this.generateReceiptNumber(warehouseId);

    // Создаем новый чек
    const newReceipt = this.receiptRepository.create({
      warehouseId,
      cashShiftId: shift.id,
      cashRegisterId: cashRegister.id,
      cashierId: userId,
      receiptNumber,
      totalAmount: 0, // Будет рассчитано после добавления товаров
      discountAmount: 0,
      finalAmount: 0, // Будет рассчитано после добавления товаров
      status: ReceiptStatus.CREATED,
    });

    const savedReceipt = await this.receiptRepository.save(newReceipt);

    return {
      id: savedReceipt.id,
      receiptNumber: savedReceipt.receiptNumber,
      date: savedReceipt.date,
      status: savedReceipt.status,
    };
  }

  /**
   * Генерация номера чека
   */
  private async generateReceiptNumber(warehouseId: string): Promise<string> {
    // Получаем последний чек для склада
    const lastReceipt = await this.receiptRepository.findOne({
      where: {
        warehouseId,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    // Если чеков еще нет, начинаем с 1
    let nextNumber = 1;

    if (lastReceipt) {
      // Если чеки уже есть, увеличиваем последний номер на 1
      const lastNumberMatch = lastReceipt.receiptNumber.match(/\d+$/);
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }

    // Форматируем номер чека (например: "R-0001")
    return `R-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Добавление товара в чек
   */
  async addItemToReceipt(
    warehouseId: string,
    receiptId: string,
    userId: string,
    addItemDto: any
  ) {
    console.log('[CashierService] Adding item to receipt:', {
      warehouseId,
      receiptId,
      userId,
      addItemDto,
      timestamp: new Date().toISOString(),
    });

    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId: warehouseId,
      },
      relations: ['cashShift', 'cashShift.cashRegister'],
    });

    console.log('[CashierService] Found receipt:', {
      receiptId: receipt?.id,
      status: receipt?.status,
      cashShiftId: receipt?.cashShift?.id,
      cashShiftStatus: receipt?.cashShift?.status,
    });

    if (!receipt) {
      console.log('[CashierService] Receipt not found');
      throw new NotFoundException('Чек не найден');
    }

    // Проверяем статус чека
    if (receipt.status !== ReceiptStatus.CREATED) {
      console.log('[CashierService] Invalid receipt status:', receipt.status);
      throw new BadRequestException(
        'Невозможно изменить оплаченный или отмененный чек'
      );
    }

    // Проверяем статус смены
    if (
      !receipt.cashShift ||
      receipt.cashShift.status !== CashShiftStatus.OPEN
    ) {
      console.log('[CashierService] Invalid shift status:', {
        shiftExists: !!receipt.cashShift,
        shiftId: receipt.cashShift?.id,
        shiftStatus: receipt.cashShift?.status,
        expectedStatus: CashShiftStatus.OPEN,
        timestamp: new Date().toISOString(),
      });
      throw new BadRequestException('Смена не открыта');
    }

    // Проверяем существование товара
    const product = await this.warehouseProductRepository.findOne({
      where: {
        id: addItemDto.warehouseProductId,
        warehouseId: warehouseId,
      },
      relations: ['barcode'],
    });

    console.log('[CashierService] Found product:', {
      productId: product?.id,
      name: product?.barcode?.productName,
      warehouseId: product?.warehouseId,
    });

    if (!product) {
      console.log('[CashierService] Product not found');
      throw new NotFoundException('Товар не найден');
    }

    // Создаем новую позицию в чеке
    const receiptItem = this.receiptItemRepository.create({
      receiptId: receipt.id,
      warehouseProductId: product.id,
      name: product.barcode.productName,
      price: addItemDto.price,
      quantity: addItemDto.quantity,
      amount: addItemDto.price * addItemDto.quantity,
      discountPercent: addItemDto.discountPercent || 0,
      discountAmount:
        (addItemDto.price *
          addItemDto.quantity *
          (addItemDto.discountPercent || 0)) /
        100,
      finalAmount:
        addItemDto.price * addItemDto.quantity -
        (addItemDto.price *
          addItemDto.quantity *
          (addItemDto.discountPercent || 0)) /
          100,
      type: product.isService
        ? ReceiptItemType.SERVICE
        : ReceiptItemType.PRODUCT,
    });

    console.log('[CashierService] Created receipt item:', {
      itemId: receiptItem.id,
      name: receiptItem.name,
      price: receiptItem.price,
      quantity: receiptItem.quantity,
      finalAmount: receiptItem.finalAmount,
    });

    // Сохраняем позицию
    await this.receiptItemRepository.save(receiptItem);

    // Обновляем итоги чека
    await this.updateReceiptTotals(receiptId);

    return receiptItem;
  }

  /**
   * Удаление товара из чека
   */
  async removeItemFromReceipt(
    warehouseId: string,
    receiptId: string,
    itemId: string,
    userId: string
  ) {
    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId: warehouseId,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Чек не найден');
    }

    // Проверяем статус чека
    if (receipt.status !== ReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Невозможно изменить оплаченный или отмененный чек'
      );
    }

    // Проверяем существование позиции
    const receiptItem = await this.receiptItemRepository.findOne({
      where: {
        id: itemId,
        receiptId: receiptId,
      },
    });

    if (!receiptItem) {
      throw new NotFoundException('Позиция в чеке не найдена');
    }

    // Удаляем позицию
    await this.receiptItemRepository.remove(receiptItem);

    // Обновляем итоги чека
    await this.updateReceiptTotals(receiptId);

    return { success: true, message: 'Позиция успешно удалена из чека' };
  }

  /**
   * Обновление итогов чека
   */
  private async updateReceiptTotals(receiptId: string) {
    // Получаем все позиции чека
    const items = await this.receiptItemRepository.find({
      where: { receiptId: receiptId },
    });

    console.log(
      'Updating receipt totals. Items:',
      items.map((item) => ({
        id: item.id,
        amount: item.amount,
        amountType: typeof item.amount,
        discountAmount: item.discountAmount,
        discountAmountType: typeof item.discountAmount,
      }))
    );

    // Рассчитываем итоги
    const totalAmount = Number(
      items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)
    );
    const discountAmount = Number(
      items
        .reduce((sum, item) => sum + Number(item.discountAmount), 0)
        .toFixed(2)
    );
    const finalAmount = Number((totalAmount - discountAmount).toFixed(2));

    console.log('Calculated totals:', {
      totalAmount,
      totalAmountType: typeof totalAmount,
      discountAmount,
      discountAmountType: typeof discountAmount,
      finalAmount,
      finalAmountType: typeof finalAmount,
    });

    // Обновляем чек
    await this.receiptRepository.update(receiptId, {
      totalAmount,
      discountAmount,
      finalAmount,
    });

    console.log('Receipt totals updated successfully');
  }

  /**
   * Получение списка отложенных чеков
   */
  async getPostponedReceipts(warehouseId: string) {
    const postponedReceipts = await this.receiptRepository.find({
      where: {
        warehouseId,
        status: ReceiptStatus.POSTPONED,
      },
      relations: ['items'],
      order: {
        createdAt: 'DESC',
      },
    });

    return postponedReceipts;
  }

  /**
   * Отложить чек
   */
  async postponeReceipt(
    warehouseId: string,
    receiptId: string,
    userId: string
  ) {
    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId,
      },
      relations: ['items'],
    });

    if (!receipt) {
      throw new NotFoundException('Чек не найден');
    }

    // Проверяем статус чека
    if (receipt.status !== ReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Можно отложить только чек в статусе "Создан"'
      );
    }

    // Обновляем статус чека
    receipt.status = ReceiptStatus.POSTPONED;
    const savedReceipt = await this.receiptRepository.save(receipt);

    return savedReceipt;
  }

  /**
   * Восстановить отложенный чек
   */
  async restorePostponedReceipt(
    warehouseId: string,
    receiptId: string,
    userId: string
  ) {
    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId,
      },
      relations: ['items'],
    });

    if (!receipt) {
      throw new NotFoundException('Чек не найден');
    }

    // Проверяем статус чека
    if (receipt.status !== ReceiptStatus.POSTPONED) {
      throw new BadRequestException('Можно восстановить только отложенный чек');
    }

    // Обновляем статус чека
    receipt.status = ReceiptStatus.CREATED;
    const savedReceipt = await this.receiptRepository.save(receipt);

    return savedReceipt;
  }

  /**
   * Удаление пустого чека
   */
  async deleteReceipt(warehouseId: string, receiptId: string, userId: string) {
    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId,
      },
      relations: ['items'],
    });

    if (!receipt) {
      throw new NotFoundException('Чек не найден');
    }

    // Проверяем, что чек пустой
    if (receipt.items.length > 0) {
      throw new BadRequestException('Нельзя удалить чек с товарами');
    }

    // Проверяем статус чека
    if (receipt.status !== ReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Можно удалить только чек в статусе "Создан"'
      );
    }

    // Удаляем чек
    await this.receiptRepository.remove(receipt);

    return { success: true, message: 'Чек успешно удален' };
  }

  /**
   * Оплата чека
   */
  async payReceipt(
    warehouseId: string,
    receiptId: string,
    paymentData: { paymentMethodId: string; amount: number },
    userId: string
  ) {
    console.log('[CashierService] payReceipt called with:', {
      warehouseId,
      receiptId,
      paymentData,
      userId,
    });

    try {
      // Находим чек
      const receipt = await this.receiptRepository.findOne({
        where: {
          id: receiptId,
          warehouseId,
          status: ReceiptStatus.CREATED,
        },
        relations: ['cashShift', 'cashRegister'],
      });

      console.log('[CashierService] Found receipt:', receipt);

      if (!receipt) {
        throw new NotFoundException('Чек не найден или уже оплачен');
      }

      // Проверяем статус смены
      if (receipt.cashShift.status !== CashShiftStatus.OPEN) {
        throw new BadRequestException('Смена закрыта');
      }

      // Находим метод оплаты
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          id: paymentData.paymentMethodId,
          warehouseId,
        },
      });

      console.log('[CashierService] Found payment method:', paymentMethod);

      if (!paymentMethod) {
        throw new NotFoundException('Метод оплаты не найден');
      }

      // Проверяем сумму оплаты
      if (paymentData.amount < receipt.finalAmount) {
        throw new BadRequestException('Недостаточная сумма оплаты');
      }

      // Создаем операцию по кассе
      const cashOperation = this.cashOperationRepository.create({
        warehouseId,
        cashRegisterId: receipt.cashRegisterId,
        shiftId: receipt.cashShiftId,
        userId,
        receiptId: receipt.id,
        operationType: CashOperationType.SALE,
        amount: receipt.finalAmount,
        paymentMethod: paymentMethod.systemType || PaymentMethodType.CASH,
        description: `Оплата чека ${receipt.receiptNumber}`,
      });

      console.log('[CashierService] Created cash operation:', cashOperation);

      await this.cashOperationRepository.save(cashOperation);

      // Получаем текущий баланс метода оплаты и конвертируем в число с 2 десятичными знаками
      const currentBalance = Number(
        Number(paymentMethod.currentBalance || 0).toFixed(2)
      );
      const finalAmount = Number(Number(receipt.finalAmount).toFixed(2));

      // Проверяем, что новый баланс не превысит максимальное значение (99999999.99)
      const newBalance = currentBalance + finalAmount;
      if (newBalance > 99999999.99) {
        throw new BadRequestException(
          'Превышено максимальное значение баланса метода оплаты'
        );
      }

      // Создаем транзакцию метода оплаты
      const transaction = this.paymentMethodTransactionRepository.create({
        paymentMethodId: paymentMethod.id,
        shiftId: receipt.cashShiftId,
        amount: finalAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        transactionType: TransactionType.SALE,
        referenceType: ReferenceType.SALE,
        referenceId: receipt.id,
        note: `Оплата чека ${receipt.receiptNumber}`,
        createdById: userId,
      });

      console.log(
        '[CashierService] Created payment method transaction:',
        transaction
      );

      await this.paymentMethodTransactionRepository.save(transaction);

      // Обновляем баланс метода оплаты
      await this.paymentMethodRepository.update(
        { id: paymentMethod.id },
        {
          currentBalance: newBalance,
        }
      );

      // Обновляем статус чека
      receipt.status = ReceiptStatus.PAID;
      receipt.paymentMethod =
        paymentMethod.systemType === PaymentMethodType.CASH
          ? PaymentMethod.CASH
          : PaymentMethod.CARD;
      receipt.cashOperationId = cashOperation.id;

      const updatedReceipt = await this.receiptRepository.save(receipt);

      console.log('[CashierService] Updated receipt:', updatedReceipt);

      return {
        ...updatedReceipt,
        change: Number((paymentData.amount - receipt.finalAmount).toFixed(2)),
      };
    } catch (error) {
      console.error('[CashierService] Error in payReceipt:', error);
      throw error;
    }
  }

  /**
   * Получение текущего активного чека
   */
  async getCurrentReceipt(warehouseId: string) {
    return this.receiptRepository.findOne({
      where: {
        warehouseId,
        status: ReceiptStatus.CREATED,
      },
      relations: ['items', 'cashShift', 'cashRegister'],
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
