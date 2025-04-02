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
import { CreateReturnWithoutReceiptDto } from '../dto/cashier/create-return-without-receipt.dto';
import { PaymentMethodSource } from '../entities/register-payment-method.entity';

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
      const currentShift = await this.cashShiftRepository.findOne({
        where: {
          cashRegister: {
            warehouseId,
          },
          status: CashShiftStatus.OPEN,
        },
        relations: ['cashRegister'],
      });

      console.log('[CashierService] Found current shift:', {
        found: !!currentShift,
        shiftId: currentShift?.id,
        cashRegisterId: currentShift?.cashRegister?.id,
        status: currentShift?.status,
        timestamp: new Date().toISOString(),
      });

      return currentShift;
    } catch (error) {
      console.error('[CashierService] Error in getCurrentShift:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
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

  async createReturn(
    warehouseId: string,
    receiptId: string,
    returnData: {
      items: Array<{ receiptItemId: string; quantity: number }>;
      reason: string;
    },
    userId: string
  ) {
    // Найти оригинальный чек
    const originalReceipt = await this.receiptRepository.findOne({
      where: { id: receiptId, warehouseId },
      relations: ['items', 'cashShift', 'cashRegister', 'cashOperation'],
    });

    if (!originalReceipt) {
      throw new NotFoundException('Чек не найден');
    }

    if (originalReceipt.status !== ReceiptStatus.PAID) {
      throw new BadRequestException(
        'Возврат возможен только по оплаченному чеку'
      );
    }

    // Проверить наличие открытой смены
    const currentShift = await this.cashShiftRepository.findOne({
      where: {
        cashRegister: {
          warehouseId,
          id: originalReceipt.cashRegisterId,
        },
        status: CashShiftStatus.OPEN,
      },
      relations: ['cashRegister'],
    });

    if (!currentShift) {
      throw new BadRequestException(
        'Необходимо открыть смену для выполнения возврата'
      );
    }

    // Создать чек возврата
    const returnReceipt = this.receiptRepository.create({
      warehouseId,
      cashShiftId: currentShift.id,
      cashRegisterId: originalReceipt.cashRegisterId,
      cashierId: userId,
      receiptNumber: await this.generateReceiptNumber(warehouseId),
      date: new Date(),
      totalAmount: 0,
      discountAmount: 0,
      finalAmount: 0,
      paymentMethod: originalReceipt.paymentMethod,
      status: ReceiptStatus.REFUNDED,
      comment: `Возврат по чеку ${originalReceipt.receiptNumber}. Причина: ${returnData.reason}`,
    });

    // Обработать возвращаемые товары
    let totalReturnAmount = 0;
    const returnItems = [];

    for (const returnItem of returnData.items) {
      const originalItem = originalReceipt.items.find(
        (item) => item.id === returnItem.receiptItemId
      );

      if (!originalItem) {
        throw new BadRequestException(
          `Товар с ID ${returnItem.receiptItemId} не найден в чеке`
        );
      }

      if (returnItem.quantity > originalItem.quantity) {
        throw new BadRequestException(
          `Количество возврата (${returnItem.quantity}) превышает количество в чеке (${originalItem.quantity})`
        );
      }

      // Рассчитать сумму возврата для товара
      const itemReturnAmount =
        (originalItem.finalAmount / originalItem.quantity) *
        returnItem.quantity;
      totalReturnAmount += itemReturnAmount;

      // Создать позицию в чеке возврата
      returnItems.push(
        this.receiptItemRepository.create({
          receipt: returnReceipt,
          name: originalItem.name,
          price: originalItem.price,
          quantity: returnItem.quantity,
          amount: itemReturnAmount,
          discountPercent: originalItem.discountPercent,
          discountAmount:
            (originalItem.discountAmount / originalItem.quantity) *
            returnItem.quantity,
          finalAmount: itemReturnAmount,
          type: originalItem.type,
          warehouseProductId: originalItem.warehouseProductId,
        })
      );

      // Вернуть товар на склад
      if (originalItem.warehouseProductId) {
        await this.warehouseProductRepository.increment(
          { id: originalItem.warehouseProductId },
          'quantity',
          returnItem.quantity
        );
      }
    }

    // Обновить суммы в чеке возврата
    returnReceipt.totalAmount = totalReturnAmount;
    returnReceipt.finalAmount = totalReturnAmount;

    // Создать кассовую операцию возврата
    const cashOperation = await this.cashOperationRepository.save({
      warehouseId,
      cashRegisterId: originalReceipt.cashRegisterId,
      shiftId: currentShift.id,
      operationType: CashOperationType.RETURN,
      amount: totalReturnAmount,
      paymentMethod: originalReceipt.cashOperation.paymentMethod,
      description: `Возврат по чеку ${originalReceipt.receiptNumber}`,
      userId,
      receiptId: returnReceipt.id,
    });

    returnReceipt.cashOperation = cashOperation;

    // Сохранить чек возврата с позициями
    const savedReceipt = await this.receiptRepository.save(returnReceipt);
    await this.receiptItemRepository.save(returnItems);

    // Создать транзакцию возврата в методе оплаты
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {
        cashRegisterId: originalReceipt.cashRegisterId,
        systemType: originalReceipt.cashOperation.paymentMethod,
      },
    });

    if (paymentMethod) {
      await this.paymentMethodTransactionRepository.save({
        paymentMethod: { id: paymentMethod.id },
        shift: { id: currentShift.id },
        amount: -totalReturnAmount,
        balanceBefore: paymentMethod.currentBalance,
        balanceAfter: paymentMethod.currentBalance - totalReturnAmount,
        transactionType: TransactionType.REFUND,
        referenceType: ReferenceType.REFUND,
        referenceId: savedReceipt.id,
        createdBy: { id: userId },
      });

      // Обновить баланс метода оплаты
      await this.paymentMethodRepository.update(
        { id: paymentMethod.id },
        { currentBalance: paymentMethod.currentBalance - totalReturnAmount }
      );
    }

    return savedReceipt;
  }

  /**
   * Создание возврата без чека
   */
  async createReturnWithoutReceipt(
    warehouseId: string,
    returnData: CreateReturnWithoutReceiptDto,
    userId: string
  ) {
    console.log('[CashierService] Starting createReturnWithoutReceipt:', {
      warehouseId,
      userId,
      returnData,
      hasItems: returnData?.items?.length > 0,
      firstItem: returnData?.items?.[0],
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate input data
      if (
        !returnData ||
        !Array.isArray(returnData.items) ||
        returnData.items.length === 0
      ) {
        console.log('[CashierService] Invalid return data:', {
          returnData,
          isArray: Array.isArray(returnData?.items),
          length: returnData?.items?.length,
        });
        throw new BadRequestException(
          'Invalid return data: items array is required and must not be empty'
        );
      }

      // Get current shift
      const currentShift = await this.getCurrentShift(warehouseId, userId);
      console.log('[CashierService] Current shift:', {
        found: !!currentShift,
        shiftId: currentShift?.id,
        cashRegisterId: currentShift?.cashRegister?.id,
        status: currentShift?.status,
        timestamp: new Date().toISOString(),
      });

      if (!currentShift) {
        throw new BadRequestException('No open shift found');
      }

      // Форматируем данные перед отправкой
      const formattedData = {
        ...returnData,
        items: returnData.items.map((item) => ({
          ...item,
          price: Number(Number(item.price).toFixed(2)),
          quantity: Number(item.quantity),
        })),
      };

      // Создаем чек возврата
      const returnReceipt = this.receiptRepository.create({
        warehouseId,
        cashShiftId: currentShift.id,
        cashRegisterId: currentShift.cashRegister.id,
        cashierId: userId,
        receiptNumber: await this.generateReceiptNumber(warehouseId),
        date: new Date(),
        status: ReceiptStatus.REFUNDED,
        comment: `Возврат без чека. Причина: ${returnData.reason}`,
      });

      // Обрабатываем возвращаемые товары
      let totalReturnAmount = 0;
      const returnItems = [];

      for (const item of formattedData.items) {
        console.log('[CashierService] Processing return item:', {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          timestamp: new Date().toISOString(),
        });

        // Проверяем существование товара
        const product = await this.warehouseProductRepository.findOne({
          where: { id: item.productId, warehouseId },
          relations: ['barcode'],
        });

        if (!product) {
          throw new NotFoundException(`Товар с ID ${item.productId} не найден`);
        }

        // Рассчитываем сумму возврата с форматированной ценой
        const itemReturnAmount = item.price * item.quantity;
        totalReturnAmount += itemReturnAmount;

        // Создаем позицию в чеке возврата
        const returnItem = this.receiptItemRepository.create({
          receipt: returnReceipt,
          name: product.barcode.productName,
          price: item.price,
          quantity: item.quantity,
          amount: itemReturnAmount,
          finalAmount: itemReturnAmount,
          type: product.isService
            ? ReceiptItemType.SERVICE
            : ReceiptItemType.PRODUCT,
          warehouseProductId: product.id,
        });

        returnItems.push(returnItem);

        // Обновляем количество на складе
        await this.warehouseProductRepository.increment(
          { id: product.id },
          'quantity',
          item.quantity
        );
      }

      // Обновляем суммы в чеке возврата
      returnReceipt.totalAmount = Number(totalReturnAmount.toFixed(2));
      returnReceipt.finalAmount = Number(totalReturnAmount.toFixed(2));

      // Получаем метод оплаты
      const selectedPaymentMethod = await this.paymentMethodRepository.findOne({
        where: [
          {
            id: returnData.paymentMethodId,
            cashRegisterId: currentShift.cashRegister.id,
          },
          {
            id: returnData.paymentMethodId,
            isShared: true,
          },
        ],
      });

      if (!selectedPaymentMethod) {
        throw new NotFoundException('Метод оплаты не найден');
      }

      // Определяем тип метода оплаты
      let paymentMethodType = selectedPaymentMethod.systemType;

      // Если systemType не указан, используем CASH для кастомных методов
      if (!paymentMethodType) {
        if (selectedPaymentMethod.source === PaymentMethodSource.CUSTOM) {
          paymentMethodType = PaymentMethodType.CASH;
        } else {
          throw new BadRequestException('Некорректный тип метода оплаты');
        }
      }

      // Создаем кассовую операцию
      const cashOperation = await this.cashOperationRepository.save({
        warehouseId,
        cashRegisterId: currentShift.cashRegister.id,
        shiftId: currentShift.id,
        operationType: CashOperationType.RETURN_WITHOUT_RECEIPT,
        amount: Number(totalReturnAmount.toFixed(2)),
        paymentMethod: paymentMethodType,
        description: `Возврат без чека`,
        userId,
      });

      returnReceipt.cashOperation = cashOperation;

      // Сохраняем чек возврата
      const savedReceipt = await this.receiptRepository.save(returnReceipt);

      // Обновляем связь с сохраненным чеком для всех позиций
      for (const item of returnItems) {
        item.receipt = savedReceipt;
      }

      // Теперь сохраняем позиции
      await this.receiptItemRepository.save(returnItems);

      console.log('[CashierService] Saved return receipt and items:', {
        receiptId: savedReceipt.id,
        itemsCount: returnItems.length,
        totalAmount: savedReceipt.totalAmount,
        timestamp: new Date().toISOString(),
      });

      // Создаем транзакцию метода оплаты
      const transaction = await this.paymentMethodTransactionRepository.save({
        paymentMethod: { id: selectedPaymentMethod.id },
        shift: { id: currentShift.id },
        amount: -totalReturnAmount,
        balanceBefore: selectedPaymentMethod.currentBalance,
        balanceAfter: selectedPaymentMethod.currentBalance - totalReturnAmount,
        transactionType: TransactionType.RETURN_WITHOUT_RECEIPT,
        referenceType: ReferenceType.REFUND,
        referenceId: savedReceipt.id,
        createdBy: { id: userId },
      });

      // Обновляем баланс метода оплаты
      await this.paymentMethodRepository.update(
        { id: selectedPaymentMethod.id },
        {
          currentBalance:
            selectedPaymentMethod.currentBalance - totalReturnAmount,
        }
      );

      return savedReceipt;
    } catch (error) {
      console.error('[CashierService] Error in createReturnWithoutReceipt:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Поиск чеков по номеру
   */
  async searchReceipts(warehouseId: string, receiptNumber: string) {
    console.log('[CashierService] Searching receipts:', {
      warehouseId,
      receiptNumber,
      timestamp: new Date().toISOString(),
    });

    try {
      const receipts = await this.receiptRepository.find({
        where: {
          warehouseId,
          receiptNumber: Like(`%${receiptNumber}%`),
          status: ReceiptStatus.PAID,
        },
        relations: ['items', 'cashShift', 'cashRegister'],
        order: {
          createdAt: 'DESC',
        },
      });

      console.log('[CashierService] Found receipts:', {
        count: receipts.length,
        receiptIds: receipts.map((r) => r.id),
        timestamp: new Date().toISOString(),
      });

      return receipts;
    } catch (error) {
      console.error('[CashierService] Error searching receipts:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}
