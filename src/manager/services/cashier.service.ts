import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
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
import { CashOperation } from '../entities/cash-operation.entity';
import {
  PaymentMethodTransaction,
  TransactionType,
  ReferenceType,
} from '../entities/payment-method-transaction.entity';
import { CreateReturnWithoutReceiptDto } from '../dto/cashier/create-return-without-receipt.dto';
import {
  CashOperationType,
  PaymentMethodType,
  PaymentMethodSource,
  PaymentMethodStatus,
} from '../enums/common.enums';
import { CreateReturnDto } from '../dto/cashier/create-return.dto';
import { ReceiptType } from '../entities/receipt-action.entity';
import { Logger } from '@nestjs/common';
import { Client } from '../entities/client.entity';
import { Vehicle } from '../entities/vehicle.entity';

interface GetReceiptsParams {
  date?: string;
  shiftId?: string;
}

@Injectable()
export class CashierService {
  private readonly logger = new Logger(CashierService.name);

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
    private readonly paymentMethodTransactionRepository: Repository<PaymentMethodTransaction>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>
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
   * Получение итогов смены
   */
  async getShiftTotals(shiftId: string) {
    this.logger.log(
      `[getShiftTotals] Starting calculation for shift: ${shiftId}`
    );

    // Get all receipts for this shift
    const receipts = await this.receiptRepository.find({
      where: {
        cashShiftId: shiftId,
        status: In([ReceiptStatus.PAID, ReceiptStatus.REFUNDED]),
      },
    });

    this.logger.log(`[getShiftTotals] Found ${receipts.length} receipts`);
    this.logger.debug(
      '[getShiftTotals] Receipts:',
      receipts.map((r) => ({
        id: r.id,
        status: r.status,
        finalAmount: r.finalAmount,
      }))
    );

    // Get all payment method transactions for these receipts
    const transactions = await this.paymentMethodTransactionRepository.find({
      where: {
        referenceId: In(receipts.map((r) => r.id)),
        referenceType: In([ReferenceType.SALE, ReferenceType.REFUND]),
      },
      relations: ['paymentMethod'],
    });

    this.logger.log(
      `[getShiftTotals] Found ${transactions.length} transactions`
    );
    this.logger.debug(
      '[getShiftTotals] Transactions:',
      transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        methodId: t.paymentMethod?.id,
        methodName: t.paymentMethod?.name,
      }))
    );

    // Calculate total sales and returns
    let totalSales = 0;
    let totalReturns = 0;

    // Group transactions by receipt to determine operation type
    const receiptTransactions = new Map<string, PaymentMethodTransaction[]>();
    for (const transaction of transactions) {
      const receiptId = transaction.referenceId;
      if (!receiptTransactions.has(receiptId)) {
        receiptTransactions.set(receiptId, []);
      }
      receiptTransactions.get(receiptId)!.push(transaction);
    }

    this.logger.log(
      `[getShiftTotals] Grouped transactions by ${receiptTransactions.size} receipts`
    );

    // Initialize Map for payment method totals
    const paymentMethodTotals = new Map<
      string,
      {
        methodId: string;
        methodName: string;
        sales: number;
        returns: number;
        total: number;
        operationType: 'sale' | 'return';
      }
    >();

    // Process each receipt and its transactions
    for (const receipt of receipts) {
      const amount = Number(receipt.finalAmount) || 0;
      const isReturn = amount < 0;

      this.logger.debug(`[getShiftTotals] Processing receipt ${receipt.id}:`, {
        amount,
        isReturn,
        status: receipt.status,
      });

      // Update totals
      if (isReturn) {
        totalReturns += Math.abs(amount);
      } else {
        totalSales += amount;
      }

      // Get transactions for this receipt
      const receiptTxs = receiptTransactions.get(receipt.id) || [];
      this.logger.debug(
        `[getShiftTotals] Receipt ${receipt.id} has ${receiptTxs.length} transactions`
      );

      // Process each transaction
      for (const transaction of receiptTxs) {
        const paymentMethod = transaction.paymentMethod;
        if (!paymentMethod) {
          this.logger.warn(
            `[getShiftTotals] Transaction ${transaction.id} has no payment method`
          );
          continue;
        }

        const methodId = paymentMethod.id;
        const methodName = paymentMethod.name || paymentMethod.systemType;

        let methodTotal = paymentMethodTotals.get(methodId);
        if (!methodTotal) {
          methodTotal = {
            methodId,
            methodName,
            sales: 0,
            returns: 0,
            total: 0,
            operationType: isReturn ? 'return' : 'sale',
          };
          paymentMethodTotals.set(methodId, methodTotal);
          this.logger.debug(
            `[getShiftTotals] Created new method total for ${methodName}`
          );
        }

        // Update amounts for payment method
        const transactionAmount = Math.abs(Number(transaction.amount) || 0);
        if (isReturn) {
          methodTotal.returns += transactionAmount;
          methodTotal.operationType = 'return';
          this.logger.debug(
            `[getShiftTotals] Added return ${transactionAmount} to ${methodName}`
          );
        } else {
          methodTotal.sales += transactionAmount;
          methodTotal.operationType = 'sale';
          this.logger.debug(
            `[getShiftTotals] Added sale ${transactionAmount} to ${methodName}`
          );
        }
        methodTotal.total = methodTotal.sales - methodTotal.returns;
      }
    }

    // Convert Map to array
    const paymentMethods = Array.from(paymentMethodTotals.values());
    this.logger.log(
      `[getShiftTotals] Created ${paymentMethods.length} payment method records`
    );

    // Split methods into sales and returns
    const salesMethods = paymentMethods.filter((method) => method.sales > 0);
    const returnMethods = paymentMethods.filter((method) => method.returns > 0);

    this.logger.log(
      `[getShiftTotals] Split into ${salesMethods.length} sales methods and ${returnMethods.length} return methods`
    );

    // Combine all methods, preserving correct operationType
    const allMethods = [
      ...salesMethods.map((method) => ({
        ...method,
        operationType: 'sale' as const,
      })),
      ...returnMethods.map((method) => ({
        ...method,
        operationType: 'return' as const,
      })),
    ];

    const result = {
      totalSales,
      totalReturns,
      totalNet: totalSales - totalReturns,
      paymentMethods: allMethods,
    };

    this.logger.log('[getShiftTotals] Final result:', result);
    return result;
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
      relations: [
        'cashRegister',
        'cashRegister.warehouse',
        'openedBy',
        'closedBy',
      ],
    });

    if (!shift) {
      throw new NotFoundException('Открытая смена не найдена');
    }

    // Получаем итоги смены
    const shiftTotals = await this.getShiftTotals(shift.id);

    // Обновляем смену
    shift.endTime = new Date();
    shift.closedById = userId;
    shift.finalAmount = closeShiftDto.finalAmount;
    shift.notes = closeShiftDto.notes;
    shift.status = CashShiftStatus.CLOSED;

    const savedShift = await this.cashShiftRepository.save(shift);

    // Формируем ответ с полной информацией о закрытой смене
    return {
      id: savedShift.id,
      warehouse: {
        id: shift.cashRegister.warehouse.id,
        name: shift.cashRegister.warehouse.name,
      },
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
      startTime: shift.startTime,
      endTime: shift.endTime,
      initialAmount: shift.initialAmount,
      finalAmount: shift.finalAmount,
      status: shift.status,
      notes: shift.notes,
      ...shiftTotals,
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

    // Форматируем номер чека (например: "0001")
    return nextNumber.toString().padStart(4, '0');
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

    // Проверяем и форматируем входные данные
    const quantity = Number(addItemDto.quantity);
    const price = Number(addItemDto.price);
    const discountPercent = Number(addItemDto.discountPercent || 0);

    if (isNaN(quantity) || isNaN(price) || isNaN(discountPercent)) {
      console.error('[CashierService] Invalid numeric values:', {
        quantity,
        price,
        discountPercent,
      });
      throw new BadRequestException('Некорректные числовые значения');
    }

    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId: warehouseId,
      },
      relations: ['cashShift', 'cashShift.cashRegister', 'items'],
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

    // Проверяем, есть ли уже такой товар в чеке
    const existingItem = receipt.items?.find(
      (item) => item.warehouseProductId === product.id
    );

    let receiptItem;

    if (existingItem) {
      // Если товар уже есть в чеке, обновляем его количество и суммы
      const currentQuantity = Number(existingItem.quantity);
      if (isNaN(currentQuantity)) {
        console.error(
          '[CashierService] Invalid existing quantity:',
          existingItem.quantity
        );
        throw new BadRequestException('Некорректное количество товара в чеке');
      }

      const newQuantity = Number((currentQuantity + quantity).toFixed(3));
      if (newQuantity <= 0) {
        // Если новое количество <= 0, удаляем товар
        await this.receiptItemRepository.remove(existingItem);
        await this.updateReceiptTotals(receiptId);
        return null;
      }

      existingItem.quantity = newQuantity;
      existingItem.amount = Number((price * newQuantity).toFixed(2));
      existingItem.discountAmount = Number(
        ((existingItem.amount * discountPercent) / 100).toFixed(2)
      );
      existingItem.finalAmount = Number(
        (existingItem.amount - existingItem.discountAmount).toFixed(2)
      );

      receiptItem = await this.receiptItemRepository.save(existingItem);
    } else {
      // Если товара нет в чеке, создаем новую позицию
      if (quantity <= 0) {
        console.error(
          '[CashierService] Attempt to add item with non-positive quantity:',
          quantity
        );
        throw new BadRequestException('Количество товара должно быть больше 0');
      }

      const newQuantity = Number(quantity.toFixed(3));
      const amount = Number((price * newQuantity).toFixed(2));
      const discountAmount = Number(
        ((amount * discountPercent) / 100).toFixed(2)
      );
      const finalAmount = Number((amount - discountAmount).toFixed(2));

      receiptItem = this.receiptItemRepository.create({
        receipt: receipt,
        warehouseProductId: product.id,
        name: product.barcode.productName,
        price,
        quantity: newQuantity,
        amount,
        discountPercent,
        discountAmount,
        finalAmount,
        type: product.isService
          ? ReceiptItemType.SERVICE
          : ReceiptItemType.PRODUCT,
      });

      receiptItem = await this.receiptItemRepository.save(receiptItem);
    }

    console.log('[CashierService] Saved receipt item:', {
      itemId: receiptItem.id,
      name: receiptItem.name,
      price: receiptItem.price,
      quantity: receiptItem.quantity,
      finalAmount: receiptItem.finalAmount,
    });

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
  async deleteReceipt(
    warehouseId: string,
    receiptId: string,
    userId: string,
    forceDelete: boolean = false
  ) {
    // Подробное логирование входящих параметров запроса
    this.logger.log(
      `[deleteReceipt] НАЧАЛО ОБРАБОТКИ запроса на удаление чека:`,
      {
        warehouseId,
        receiptId,
        userId,
        forceDelete,
        forceDeleteType: typeof forceDelete,
        timestamp: new Date().toISOString(),
      }
    );

    // Проверяем существование чека
    const receipt = await this.receiptRepository.findOne({
      where: {
        id: receiptId,
        warehouseId,
      },
      relations: ['items'],
    });

    if (!receipt) {
      this.logger.warn(`[deleteReceipt] Чек ${receiptId} не найден`);
      throw new NotFoundException('Чек не найден');
    }

    // Логируем информацию о чеке и запросе
    this.logger.log(`[deleteReceipt] Запрос на удаление чека ${receiptId}:`, {
      id: receipt.id,
      status: receipt.status,
      statusLower: String(receipt.status).toLowerCase(),
      itemsCount: receipt.items.length,
      forceDelete,
      userId,
    });

    // Получаем статусы в нижнем регистре, как они определены в enum
    const createdStatus = ReceiptStatus.CREATED; // 'created'
    const postponedStatus = ReceiptStatus.POSTPONED; // 'postponed'

    // Для надежности приводим статус чека к строке и нижнему регистру
    const currentStatus = String(receipt.status).toLowerCase();

    // Проверяем, соответствует ли статус чека CREATED или POSTPONED
    const isCreated = currentStatus === createdStatus;
    const isPostponed = currentStatus === postponedStatus;

    this.logger.log(
      `[deleteReceipt] Сравнение статусов: текущий="${currentStatus}", created="${createdStatus}", postponed="${postponedStatus}", isCreated=${isCreated}, isPostponed=${isPostponed}`
    );

    // Всегда проверяем статус чека, даже при forceDelete=true
    // Разрешаем удалять только чеки в статусах CREATED и POSTPONED
    if (!isCreated && !isPostponed) {
      this.logger.warn(
        `[deleteReceipt] Попытка удалить чек ${receiptId} в недопустимом статусе: ${receipt.status}`
      );
      throw new BadRequestException(
        'Можно удалить только чек в статусе "Создан" или "Отложен"'
      );
    }

    // Проверяем, что чек пустой (но пропускаем проверку при forceDelete=true)
    if (!forceDelete && receipt.items.length > 0) {
      this.logger.warn(
        `[deleteReceipt] Попытка удалить непустой чек ${receiptId}`
      );
      throw new BadRequestException('Нельзя удалить чек с товарами');
    }

    // Если установлен forceDelete и есть товары, удаляем их сначала
    if (forceDelete && receipt.items.length > 0) {
      this.logger.log(
        `[deleteReceipt] Принудительное удаление ${receipt.items.length} товаров из чека ${receiptId}`
      );
      try {
        // Используем delete вместо remove для более надежного удаления
        await this.receiptItemRepository.delete({ receiptId: receiptId });
        this.logger.log(
          `[deleteReceipt] Товары чека ${receiptId} успешно удалены через delete`
        );

        // Перезагружаем чек после удаления товаров для проверки
        const updatedReceipt = await this.receiptRepository.findOne({
          where: { id: receiptId },
          relations: ['items'],
        });

        this.logger.log(
          `[deleteReceipt] Состояние чека ${receiptId} после удаления товаров:`,
          {
            itemsCount: updatedReceipt?.items?.length || 0,
          }
        );
      } catch (error) {
        this.logger.error(
          `[deleteReceipt] Ошибка при удалении товаров чека ${receiptId}:`,
          error
        );
        throw new InternalServerErrorException(
          'Ошибка при удалении товаров чека'
        );
      }
    }

    // Удаляем сам чек, используя delete вместо remove для более надежного удаления
    try {
      this.logger.log(
        `[deleteReceipt] Начинаем удаление чека ${receiptId} через delete`
      );

      // Для отладки проверим, что происходит с чеком перед удалением
      const checkReceiptBeforeDelete = await this.receiptRepository.findOne({
        where: { id: receiptId },
      });

      if (!checkReceiptBeforeDelete) {
        this.logger.warn(
          `[deleteReceipt] Странно: чек ${receiptId} не найден перед удалением`
        );
      } else {
        this.logger.log(
          `[deleteReceipt] Чек ${receiptId} найден перед удалением, статус: ${checkReceiptBeforeDelete.status}`
        );
      }

      const deleteResult = await this.receiptRepository.delete({
        id: receiptId,
      });
      this.logger.log(`[deleteReceipt] Результат удаления чека ${receiptId}:`, {
        affected: deleteResult.affected,
      });

      // Проверяем, действительно ли чек удален
      const checkReceipt = await this.receiptRepository.findOne({
        where: { id: receiptId },
      });

      if (checkReceipt) {
        this.logger.warn(
          `[deleteReceipt] Чек ${receiptId} всё еще существует после удаления! Статус: ${checkReceipt.status}`
        );
      } else {
        this.logger.log(
          `[deleteReceipt] Чек ${receiptId} успешно удален из базы данных`
        );
      }
    } catch (error) {
      this.logger.error(
        `[deleteReceipt] Ошибка при удалении чека ${receiptId}:`,
        error
      );
      throw new InternalServerErrorException('Ошибка при удалении чека');
    }

    return { success: true, message: 'Чек успешно удален' };
  }

  /**
   * Оплата чека
   */
  async payReceipt(
    warehouseId: string,
    receiptId: string,
    paymentData: {
      paymentMethodId: string;
      amount: number;
      clientId?: string;
      vehicleId?: string;
    },
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
        relations: ['cashShift', 'cashRegister', 'items'],
      });

      console.log('[CashierService] Found receipt:', receipt);

      if (!receipt) {
        throw new NotFoundException('Чек не найден или уже оплачен');
      }

      // Проверяем статус смены
      if (receipt.cashShift.status !== CashShiftStatus.OPEN) {
        throw new BadRequestException('Смена закрыта');
      }

      // Если передан только vehicleId без clientId, проверяем наличие клиента у автомобиля
      if (paymentData.vehicleId && !paymentData.clientId) {
        this.logger.log(
          `[payReceipt] Vehicle provided without client, checking if vehicle has client: ${paymentData.vehicleId}`
        );

        const vehicle = await this.vehicleRepository.findOne({
          where: { id: paymentData.vehicleId, isActive: true },
          relations: ['client'],
        });

        if (vehicle && vehicle.clientId) {
          this.logger.log(
            `[payReceipt] Found client for vehicle: Client ID ${vehicle.clientId}`
          );
          // Автоматически устанавливаем clientId из данных автомобиля
          paymentData.clientId = vehicle.clientId;
        }
      }

      // Если передан ID клиента, связываем чек с клиентом и применяем скидку
      if (paymentData.clientId) {
        this.logger.log(
          `[payReceipt] Processing client ${paymentData.clientId} for receipt ${receiptId}`
        );
        const client = await this.clientRepository.findOne({
          where: { id: paymentData.clientId, isActive: true },
        });

        if (client) {
          receipt.clientId = client.id;

          // Применяем скидку клиента, если она есть
          if (client.discountPercent > 0) {
            const discountPercent = Number(client.discountPercent);
            const discountAmount =
              (Number(receipt.totalAmount) * discountPercent) / 100;
            receipt.discountAmount = discountAmount;
            receipt.finalAmount = Number(receipt.totalAmount) - discountAmount;

            this.logger.log(
              `[payReceipt] Applied client discount: ${discountPercent}%, amount: ${discountAmount}`
            );
          }
        }
      }

      // Если передан ID автомобиля, связываем чек с автомобилем
      if (paymentData.vehicleId) {
        this.logger.log(
          `[payReceipt] Processing vehicle ${paymentData.vehicleId} for receipt ${receiptId}`
        );
        const vehicle = await this.vehicleRepository.findOne({
          where: {
            id: paymentData.vehicleId,
            isActive: true,
          },
        });

        if (vehicle) {
          // Проверяем, что автомобиль принадлежит выбранному клиенту (если клиент указан)
          if (
            paymentData.clientId &&
            vehicle.clientId !== paymentData.clientId
          ) {
            this.logger.warn(
              `[payReceipt] Vehicle ${paymentData.vehicleId} does not belong to client ${paymentData.clientId}`
            );
          } else {
            receipt.vehicleId = vehicle.id;
            this.logger.log(
              `[payReceipt] Associated vehicle ${vehicle.id} with receipt ${receiptId}`
            );
          }
        }
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
      const cashOperation = new CashOperation();
      cashOperation.warehouseId = warehouseId;
      cashOperation.cashRegisterId = receipt.cashRegisterId;
      cashOperation.shiftId = receipt.cashShiftId;
      cashOperation.userId = userId;
      cashOperation.receiptId = receipt.id;
      cashOperation.operationType = CashOperationType.SALE;
      cashOperation.amount = receipt.finalAmount;
      cashOperation.paymentMethodType =
        paymentMethod.systemType || PaymentMethodType.CASH;
      cashOperation.paymentMethodId = paymentMethod.id;
      cashOperation.description = `Оплата чека ${receipt.receiptNumber}`;

      const savedCashOperation =
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

      await this.paymentMethodTransactionRepository.save(transaction);

      // Обновляем баланс метода оплаты
      await this.paymentMethodRepository.update(
        { id: paymentMethod.id },
        { currentBalance: newBalance }
      );

      // Обновляем статус чека
      receipt.status = ReceiptStatus.PAID;
      receipt.paymentMethod =
        paymentMethod.systemType === PaymentMethodType.CASH
          ? PaymentMethod.CASH
          : PaymentMethod.CARD;
      receipt.paymentMethodId = paymentMethod.id;
      receipt.cashOperationId = savedCashOperation.id;

      // Уменьшаем количество товаров на складе
      for (const item of receipt.items) {
        if (!item.warehouseProductId || item.type === ReceiptItemType.SERVICE) {
          continue; // Пропускаем услуги и товары без привязки к складу
        }

        const product = await this.warehouseProductRepository.findOne({
          where: { id: item.warehouseProductId },
        });

        if (!product) {
          console.error(`Product not found: ${item.warehouseProductId}`);
          continue;
        }

        // Преобразуем строковые значения в числа перед сравнением
        const productQuantity = Number(product.quantity);
        const requiredQuantity = Number(item.quantity);

        if (productQuantity < requiredQuantity) {
          throw new BadRequestException(
            `Недостаточное количество товара "${item.name}" на складе. В наличии: ${productQuantity}, требуется: ${requiredQuantity}`
          );
        }

        await this.warehouseProductRepository.update(
          { id: item.warehouseProductId },
          { quantity: () => `quantity - ${requiredQuantity}` }
        );

        console.log('[CashierService] Updated product quantity:', {
          productId: item.warehouseProductId,
          name: item.name,
          oldQuantity: productQuantity,
          deductedQuantity: requiredQuantity,
          newQuantity: productQuantity - requiredQuantity,
        });
      }

      const updatedReceipt = await this.receiptRepository.save(receipt);

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
    this.logger.log(
      `[getCurrentReceipt] Запрос текущего чека для склада ${warehouseId}`
    );

    // Используем точный статус в нижнем регистре, как он определен в enum
    const currentStatus = ReceiptStatus.CREATED; // 'created'

    this.logger.log(
      `[getCurrentReceipt] Ищем чек со статусом "${currentStatus}"`
    );

    // Получаем активную смену для склада, чтобы убедиться, что чек принадлежит открытой смене
    const activeShift = await this.cashShiftRepository.findOne({
      where: {
        status: CashShiftStatus.OPEN,
        cashRegister: { warehouseId },
      },
      select: ['id'],
    });

    this.logger.log(
      `[getCurrentReceipt] Активная смена для склада ${warehouseId}:`,
      activeShift ? { shiftId: activeShift.id } : 'Не найдена'
    );

    // Создаем запрос с точным статусом и проверкой активной смены
    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.items', 'items')
      .leftJoinAndSelect('receipt.cashShift', 'cashShift')
      .leftJoinAndSelect('receipt.cashRegister', 'cashRegister')
      .where('receipt.warehouseId = :warehouseId', { warehouseId })
      .andWhere('receipt.status = :status', { status: currentStatus });

    // Добавляем условие проверки смены, если найдена активная смена
    if (activeShift) {
      queryBuilder.andWhere('receipt.cashShiftId = :shiftId', {
        shiftId: activeShift.id,
      });
    } else {
      // Если нет активной смены, то и активного чека быть не должно
      this.logger.log(
        `[getCurrentReceipt] Нет активной смены для склада ${warehouseId}, возвращаем null`
      );
      return null;
    }

    queryBuilder.orderBy('receipt.createdAt', 'DESC');

    try {
      const receipt = await queryBuilder.getOne();

      if (receipt) {
        this.logger.log(
          `[getCurrentReceipt] Найден чек в статусе "${currentStatus}":`,
          {
            id: receipt.id,
            status: receipt.status,
            receiptNumber: receipt.receiptNumber,
            itemsCount: receipt.items?.length || 0,
            cashShiftId: receipt.cashShiftId,
          }
        );
      } else {
        this.logger.log(
          `[getCurrentReceipt] Не найдено чеков в статусе "${currentStatus}" для активной смены`
        );

        // Для отладки проверим, есть ли вообще какие-то чеки для этого склада
        const anyReceipts = await this.receiptRepository.find({
          where: { warehouseId },
          select: ['id', 'status', 'createdAt', 'receiptNumber', 'cashShiftId'],
          take: 5,
          order: { createdAt: 'DESC' },
        });

        if (anyReceipts.length > 0) {
          this.logger.log(
            `[getCurrentReceipt] Последние чеки для склада ${warehouseId}:`,
            anyReceipts
          );
        } else {
          this.logger.log(
            `[getCurrentReceipt] Нет чеков для склада ${warehouseId}`
          );
        }
      }

      return receipt;
    } catch (error) {
      this.logger.error(
        `[getCurrentReceipt] Ошибка при поиске текущего чека:`,
        error
      );
      return null; // Возвращаем null при любой ошибке
    }
  }

  async createReturn(
    warehouseId: string,
    receiptId: string,
    returnData: CreateReturnDto,
    userId: string
  ) {
    try {
      // Получаем чек
      const receipt = await this.receiptRepository.findOne({
        where: { id: receiptId, warehouseId },
        relations: ['items', 'cashShift', 'cashRegister'],
      });

      if (!receipt) {
        throw new NotFoundException('Receipt not found');
      }

      // Проверяем, что это чек продажи, а не возврата
      if (receipt.finalAmount <= 0) {
        throw new BadRequestException(
          'Нельзя сделать возврат по чеку возврата'
        );
      }

      if (receipt.status !== ReceiptStatus.PAID) {
        throw new BadRequestException('Чек не оплачен или уже имеет возврат');
      }

      // Получаем текущую смену
      const currentShift = await this.getCurrentShift(warehouseId, userId);
      if (!currentShift) {
        throw new BadRequestException('Не найдена открытая смена');
      }

      // Проверяем метод оплаты
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: { id: returnData.paymentMethodId },
      });

      if (!paymentMethod) {
        throw new NotFoundException('Метод оплаты не найден');
      }

      // Обрабатываем возврат товаров
      for (const item of receipt.items) {
        // Возвращаем товар на склад
        await this.warehouseProductRepository.increment(
          { id: item.warehouseProductId },
          'quantity',
          item.quantity
        );
      }

      // Создаем возвратный чек
      const returnReceipt = this.receiptRepository.create({
        warehouseId,
        cashShiftId: currentShift.id,
        cashRegisterId: currentShift.cashRegisterId,
        cashierId: userId,
        receiptNumber: await this.generateReceiptNumber(warehouseId),
        date: new Date(),
        totalAmount: -receipt.totalAmount,
        discountAmount: -receipt.discountAmount,
        finalAmount: -receipt.finalAmount,
        status: ReceiptStatus.PAID,
        paymentMethodId: paymentMethod.id,
        comment: `Возврат по чеку ${receipt.receiptNumber}${
          returnData.reason ? '. Причина: ' + returnData.reason : ''
        }`,
      });

      // Сохраняем возвратный чек
      const savedReturnReceipt =
        await this.receiptRepository.save(returnReceipt);

      // Создаем записи о товарах в receipt_items для возвратного чека
      for (const item of receipt.items) {
        const returnItem = this.receiptItemRepository.create({
          receipt: savedReturnReceipt,
          warehouseProductId: item.warehouseProductId,
          name: item.name,
          price: item.price,
          quantity: -item.quantity, // Отрицательное количество для возврата
          amount: -item.amount,
          discountPercent: item.discountPercent,
          discountAmount: -item.discountAmount,
          finalAmount: -item.finalAmount,
          type: item.type,
        });

        await this.receiptItemRepository.save(returnItem);
      }

      // Получаем текущий баланс метода оплаты
      const currentBalance = Number(paymentMethod.currentBalance || 0);
      const returnAmount = Math.abs(receipt.finalAmount);
      const newBalance = currentBalance - returnAmount;

      // Создаем кассовую операцию
      const cashOperation = new CashOperation();
      cashOperation.warehouseId = warehouseId;
      cashOperation.cashRegisterId = currentShift.cashRegisterId;
      cashOperation.shiftId = currentShift.id;
      cashOperation.operationType = CashOperationType.RETURN;
      cashOperation.amount = -returnAmount;
      cashOperation.paymentMethodType =
        paymentMethod.systemType || PaymentMethodType.CASH;
      cashOperation.paymentMethodId = paymentMethod.id;
      cashOperation.description = `Возврат по чеку ${receipt.receiptNumber}`;
      cashOperation.userId = userId;
      cashOperation.receiptId = savedReturnReceipt.id;

      const savedCashOperation =
        await this.cashOperationRepository.save(cashOperation);

      // Обновляем чек с информацией о кассовой операции
      savedReturnReceipt.cashOperation = savedCashOperation;
      await this.receiptRepository.save(savedReturnReceipt);

      // Создаем транзакцию для метода оплаты
      await this.paymentMethodTransactionRepository.save({
        paymentMethodId: paymentMethod.id,
        amount: -returnAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        transactionType: TransactionType.REFUND,
        referenceType: ReferenceType.REFUND,
        referenceId: savedReturnReceipt.id,
        note: `Возврат по чеку ${receipt.receiptNumber}. Причина: ${
          returnData.reason || 'Возврат товара'
        }`,
        createdById: userId,
      });

      // Обновляем баланс метода оплаты
      await this.paymentMethodRepository.update(
        { id: paymentMethod.id },
        { currentBalance: newBalance }
      );

      // Обновляем статус оригинального чека на REFUNDED
      receipt.status = ReceiptStatus.REFUNDED;
      await this.receiptRepository.save(receipt);

      // Возвращаем созданный возвратный чек
      return savedReturnReceipt;
    } catch (error) {
      this.logger.error('Error in createReturn:', error);
      throw error;
    }
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

      // Форматируем данные перед обработкой
      const formattedItems = returnData.items.map((item) => ({
        ...item,
        price: Number(Number(item.price).toFixed(2)),
        quantity: Number(item.quantity),
      }));

      const savedReceipts = [];

      // Создаем отдельный чек возврата для каждого товара
      for (const item of formattedItems) {
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

        // Устанавливаем причину по умолчанию, если она не указана
        const returnReason = returnData.reason || '';

        // Создаем чек возврата для текущего товара
        const returnReceipt = this.receiptRepository.create({
          warehouseId,
          cashShiftId: currentShift.id,
          cashRegisterId: currentShift.cashRegister.id,
          cashierId: userId,
          receiptNumber: await this.generateReceiptNumber(warehouseId),
          date: new Date(),
          status: ReceiptStatus.PAID, // Изменено с REFUNDED на PAID
          comment: `Возврат без чека. Причина: ${returnReason}`,
        });

        // Рассчитываем сумму возврата для текущего товара
        const itemReturnAmount = item.price * item.quantity;

        // Создаем позицию в чеке возврата с отрицательными значениями
        const returnItem = this.receiptItemRepository.create({
          receipt: returnReceipt,
          name: product.barcode.productName,
          price: item.price,
          quantity: -item.quantity, // Отрицательное количество для возврата
          amount: -itemReturnAmount, // Отрицательная сумма
          finalAmount: -itemReturnAmount, // Отрицательная итоговая сумма
          type: product.isService
            ? ReceiptItemType.SERVICE
            : ReceiptItemType.PRODUCT,
          warehouseProductId: product.id,
        });

        // Обновляем суммы в чеке возврата (отрицательные значения)
        returnReceipt.totalAmount = -Number(itemReturnAmount.toFixed(2));
        returnReceipt.finalAmount = -Number(itemReturnAmount.toFixed(2));

        // Создаем кассовую операцию для текущего товара с отрицательным значением
        const cashOperation = new CashOperation();
        cashOperation.warehouseId = warehouseId;
        cashOperation.cashRegisterId = currentShift.cashRegister.id;
        cashOperation.shiftId = currentShift.id;
        cashOperation.operationType = CashOperationType.RETURN_WITHOUT_RECEIPT;
        cashOperation.amount = -Number(itemReturnAmount.toFixed(2)); // Отрицательная сумма
        cashOperation.paymentMethodType = paymentMethodType;
        cashOperation.paymentMethodId = selectedPaymentMethod.id;
        cashOperation.description = `Возврат без чека`;
        cashOperation.userId = userId;

        const savedCashOperation =
          await this.cashOperationRepository.save(cashOperation);

        returnReceipt.cashOperation = savedCashOperation;
        returnReceipt.paymentMethodId = selectedPaymentMethod.id;
        returnReceipt.paymentMethod =
          PaymentMethod[paymentMethodType.toUpperCase()];

        // Сохраняем чек возврата
        const savedReceipt = await this.receiptRepository.save(returnReceipt);

        // Добавляем ссылку на чек в кассовой операции
        savedCashOperation.receiptId = savedReceipt.id;
        await this.cashOperationRepository.save(savedCashOperation);

        // Сохраняем позицию чека
        returnItem.receipt = savedReceipt;
        await this.receiptItemRepository.save(returnItem);

        // Обновляем количество на складе
        await this.warehouseProductRepository.increment(
          { id: product.id },
          'quantity',
          item.quantity
        );

        // Создаем транзакцию метода оплаты для текущего товара
        await this.paymentMethodTransactionRepository.save({
          paymentMethod: { id: selectedPaymentMethod.id },
          shift: { id: currentShift.id },
          amount: -itemReturnAmount, // Транзакция уже с отрицательной суммой, оставляем как есть
          balanceBefore: selectedPaymentMethod.currentBalance,
          balanceAfter: selectedPaymentMethod.currentBalance - itemReturnAmount,
          transactionType: TransactionType.RETURN_WITHOUT_RECEIPT,
          referenceType: ReferenceType.REFUND,
          referenceId: savedReceipt.id,
          createdBy: { id: userId },
          note: `Возврат товара без чека. Причина: ${returnReason}`,
        });

        // Обновляем баланс метода оплаты
        // Обратите внимание: мы вычитаем положительное число, что уменьшает баланс
        selectedPaymentMethod.currentBalance -= itemReturnAmount;
        await this.paymentMethodRepository.update(
          { id: selectedPaymentMethod.id },
          {
            currentBalance: selectedPaymentMethod.currentBalance,
          }
        );

        savedReceipts.push(savedReceipt);

        console.log('[CashierService] Saved return receipt for item:', {
          receiptId: savedReceipt.id,
          productId: item.productId,
          amount: itemReturnAmount,
          timestamp: new Date().toISOString(),
        });
      }

      return savedReceipts;
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
      // Format the receipt number to match the database format (0001)
      const formattedReceiptNumber = receiptNumber.padStart(4, '0');

      console.log(
        '[CashierService] Searching with formatted number:',
        formattedReceiptNumber
      );

      const receipts = await this.receiptRepository.find({
        where: {
          warehouseId,
          receiptNumber: formattedReceiptNumber,
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

  /**
   * Получение деталей чека
   */
  async getReceiptDetails(warehouseId: string, receiptId: string) {
    console.log('[CashierService] Getting receipt details:', {
      warehouseId,
      receiptId,
      timestamp: new Date().toISOString(),
    });

    try {
      const receipt = await this.receiptRepository.findOne({
        where: {
          id: receiptId,
          warehouseId,
        },
        relations: ['items', 'cashShift', 'cashRegister'],
      });

      if (!receipt) {
        throw new NotFoundException('Чек не найден');
      }

      console.log('[CashierService] Found receipt:', {
        receiptId: receipt.id,
        itemsCount: receipt.items?.length,
        timestamp: new Date().toISOString(),
      });

      return receipt;
    } catch (error) {
      console.error('[CashierService] Error getting receipt details:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Получение списка чеков для истории продаж
   */
  async getReceipts(warehouseId: string, params: GetReceiptsParams) {
    try {
      // Создаем базовый запрос с необходимыми связями
      const query = this.receiptRepository
        .createQueryBuilder('receipt')
        .leftJoinAndSelect('receipt.items', 'items')
        .leftJoinAndSelect('receipt.cashier', 'cashier')
        .leftJoinAndSelect('receipt.cashShift', 'cashShift')
        .leftJoinAndSelect('receipt.cashRegister', 'cashRegister')
        .leftJoinAndSelect('receipt.cashOperation', 'cashOperation')
        .where('receipt.warehouseId = :warehouseId', { warehouseId });

      // Фильтрация по дате
      if (params.date) {
        query.andWhere('DATE(receipt.createdAt) = :date', {
          date: params.date,
        });
      }

      // Фильтрация по смене
      if (params.shiftId) {
        query.andWhere('receipt.cashShiftId = :shiftId', {
          shiftId: params.shiftId,
        });
      }

      // Получаем только чеки со статусами PAID, REFUNDED, CANCELLED, CREATED (отложенные)
      query.andWhere('receipt.status IN (:...statuses)', {
        statuses: [
          ReceiptStatus.PAID,
          ReceiptStatus.REFUNDED,
          ReceiptStatus.CANCELLED,
          ReceiptStatus.CREATED,
        ],
      });

      // Сортировка по времени создания (сначала новые)
      query.orderBy('receipt.createdAt', 'DESC');

      const receipts = await query.getMany();

      // Форматируем ответ
      return receipts.map((receipt) => ({
        id: receipt.id,
        number: receipt.receiptNumber,
        createdAt: receipt.createdAt,
        totalAmount: Number(receipt.totalAmount || 0),
        discountAmount: Number(receipt.discountAmount || 0),
        finalAmount: Number(receipt.finalAmount || 0),
        status: receipt.status,
        paymentMethod: receipt.paymentMethod,
        paymentMethodId: receipt.paymentMethodId,
        cashier: receipt.cashier
          ? {
              id: receipt.cashier.id,
              name: `${receipt.cashier.firstName || ''} ${
                receipt.cashier.lastName || ''
              }`.trim(),
            }
          : null,
        cashRegister: receipt.cashRegister
          ? {
              id: receipt.cashRegister.id,
              name: receipt.cashRegister.name,
            }
          : null,
        shift: receipt.cashShift
          ? {
              id: receipt.cashShift.id,
              startTime: receipt.cashShift.startTime,
              endTime: receipt.cashShift.endTime,
            }
          : null,
        items: receipt.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          amount: Number(item.amount || 0),
          discountAmount: Number(item.discountAmount || 0),
          finalAmount: Number(item.finalAmount || 0),
          type: item.type,
        })),
        operation: receipt.cashOperation
          ? {
              id: receipt.cashOperation.id,
              type: receipt.cashOperation.operationType,
              amount: Number(receipt.cashOperation.amount || 0),
            }
          : null,
      }));
    } catch (error) {
      this.logger.error('Error getting receipts:', error);
      throw new InternalServerErrorException('Failed to get receipts');
    }
  }

  /**
   * Печать чека
   */
  async printReceipt(warehouseId: string, receiptId: string) {
    try {
      // Получаем чек со всеми необходимыми связями
      const receipt = await this.receiptRepository.findOne({
        where: { id: receiptId, warehouseId },
        relations: [
          'items',
          'cashier',
          'cashShift',
          'cashRegister',
          'client',
          'cashOperation',
        ],
      });

      if (!receipt) {
        throw new NotFoundException('Чек не найден');
      }

      // Проверяем, что чек можно распечатать
      if (!['PAID', 'REFUNDED', 'CANCELLED'].includes(receipt.status)) {
        throw new BadRequestException(
          'Невозможно распечатать чек в текущем статусе'
        );
      }

      // Форматируем данные чека для печати
      const printData = {
        // Основная информация о чеке
        receipt: {
          id: receipt.id,
          number: receipt.receiptNumber,
          type:
            receipt.status === ReceiptStatus.REFUNDED ? 'Возврат' : 'Продажа',
          status: this.getReceiptStatusText(receipt.status),
          createdAt: receipt.createdAt,
          totalAmount: Number(receipt.totalAmount || 0),
          discountAmount: Number(receipt.discountAmount || 0),
          finalAmount: Number(receipt.finalAmount || 0),
          paymentMethod: this.getPaymentMethodText(receipt.paymentMethod),
        },

        // Информация о товарах
        items: receipt.items.map((item) => ({
          name: item.name,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          amount: Number(item.amount || 0),
          discountAmount: Number(item.discountAmount || 0),
          finalAmount: Number(item.finalAmount || 0),
          type: item.type === 'SERVICE' ? 'Услуга' : 'Товар',
        })),

        // Информация о кассе и смене
        shop: {
          cashRegister: {
            id: receipt.cashRegister.id,
            name: receipt.cashRegister.name,
          },
          shift: {
            id: receipt.cashShift.id,
            startTime: receipt.cashShift.startTime,
          },
        },

        // Информация о кассире
        cashier: receipt.cashier
          ? {
              id: receipt.cashier.id,
              name: `${receipt.cashier.firstName || ''} ${
                receipt.cashier.lastName || ''
              }`.trim(),
            }
          : null,

        // Информация о клиенте (если есть)
        client: receipt.client
          ? {
              id: receipt.client.id,
              phone: receipt.client.phone,
            }
          : null,

        // Информация об операции
        operation: receipt.cashOperation
          ? {
              id: receipt.cashOperation.id,
              type: receipt.cashOperation.operationType,
              amount: Number(receipt.cashOperation.amount || 0),
            }
          : null,
      };

      // Здесь должна быть интеграция с фискальным регистратором
      // TODO: Добавить реальную интеграцию с фискальным регистратором

      // Возвращаем результат
      return {
        success: true,
        message: 'Чек успешно отправлен на печать',
        data: printData,
      };
    } catch (error) {
      this.logger.error('Ошибка при печати чека:', error);
      throw new InternalServerErrorException('Не удалось распечатать чек');
    }
  }

  /**
   * Получение текстового представления статуса чека
   */
  private getReceiptStatusText(status: string): string {
    switch (status) {
      case 'PAID':
        return 'Оплачен';
      case 'REFUNDED':
        return 'Возвращен';
      case 'CANCELLED':
        return 'Отменен';
      case 'CREATED':
        return 'Создан';
      default:
        return 'Неизвестный статус';
    }
  }

  /**
   * Получение текстового представления метода оплаты
   */
  private getPaymentMethodText(method: string): string {
    switch (method) {
      case 'CASH':
        return 'Наличные';
      case 'CARD':
        return 'Банковская карта';
      case 'MIXED':
        return 'Смешанная оплата';
      default:
        return 'Не указан';
    }
  }

  /**
   * Печать отчета о закрытии смены
   */
  async printShiftReport(warehouseId: string, shiftId: string, userId: string) {
    // Находим смену
    const shift = await this.cashShiftRepository.findOne({
      where: {
        id: shiftId,
        cashRegister: {
          warehouseId,
        },
      },
      relations: [
        'cashRegister',
        'cashRegister.warehouse',
        'openedBy',
        'closedBy',
      ],
    });

    if (!shift) {
      throw new NotFoundException('Смена не найдена');
    }

    // Получаем итоги смены
    const shiftTotals = await this.getShiftTotals(shift.id);

    // Формируем данные для печати
    const reportData = {
      warehouse: {
        id: shift.cashRegister.warehouse.id,
        name: shift.cashRegister.warehouse.name,
      },
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
      startTime: shift.startTime,
      endTime: shift.endTime,
      initialAmount: shift.initialAmount,
      finalAmount: shift.finalAmount,
      status: shift.status,
      notes: shift.notes,
      ...shiftTotals,
    };

    // TODO: Здесь будет вызов сервиса печати с reportData
    // Пока просто возвращаем данные
    return reportData;
  }

  /**
   * Поиск клиентов по имени, фамилии или телефону
   */
  async searchClients(warehouseId: string, query: string, userId: string) {
    this.logger.log(`[searchClients] Searching clients with query: ${query}`);

    if (!query || query.trim().length < 2) {
      return [];
    }

    // Поиск клиентов по имени, фамилии или телефону
    const clients = await this.clientRepository.find({
      where: [
        { firstName: ILike(`%${query}%`), isActive: true },
        { lastName: ILike(`%${query}%`), isActive: true },
        { phone: ILike(`%${query}%`), isActive: true },
      ],
      take: 10, // Ограничиваем результаты для производительности
    });

    this.logger.log(`[searchClients] Found ${clients.length} clients`);

    return clients.map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      discountPercent: client.discountPercent,
      email: client.email,
    }));
  }

  /**
   * Получение автомобилей клиента
   */
  async getClientVehicles(
    warehouseId: string,
    clientId: string,
    userId: string
  ) {
    this.logger.log(
      `[getClientVehicles] Getting vehicles for client: ${clientId}`
    );

    // Проверяем существование клиента
    const client = await this.clientRepository.findOne({
      where: { id: clientId, isActive: true },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    // Получаем все автомобили клиента
    const vehicles = await this.vehicleRepository.find({
      where: { clientId, isActive: true },
    });

    this.logger.log(
      `[getClientVehicles] Found ${vehicles.length} vehicles for client ${clientId}`
    );

    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plateNumber,
      bodyType: vehicle.bodyType,
      engineVolume: vehicle.engineVolume,
      vin: vehicle.vin,
      clientId: vehicle.clientId,
      hasClient: !!vehicle.clientId,
    }));
  }

  /**
   * Получение всех автомобилей для выбора в интерфейсе кассира
   */
  async getAllVehicles(warehouseId: string, query: string, userId: string) {
    this.logger.log(
      `[getAllVehicles] Getting all vehicles with search query: ${query}`
    );

    // Базовое условие поиска
    const whereConditions = { isActive: true };

    let vehicles = [];

    // Если есть поисковый запрос, добавляем условия поиска
    if (query && query.trim().length > 0) {
      const searchQuery = query.trim();
      vehicles = await this.vehicleRepository.find({
        where: [
          { make: ILike(`%${searchQuery}%`), ...whereConditions },
          { model: ILike(`%${searchQuery}%`), ...whereConditions },
          { plateNumber: ILike(`%${searchQuery}%`), ...whereConditions },
          { vin: ILike(`%${searchQuery}%`), ...whereConditions },
        ],
        relations: ['client'],
        take: 20, // Ограничиваем количество результатов
      });
    } else {
      // Если поисковый запрос не задан, возвращаем последние добавленные автомобили
      vehicles = await this.vehicleRepository.find({
        where: whereConditions,
        relations: ['client'],
        order: { createdAt: 'DESC' },
        take: 20, // Ограничиваем количество результатов
      });
    }

    // Форматируем результаты
    this.logger.log(`[getAllVehicles] Found ${vehicles.length} vehicles`);
    return vehicles.map((vehicle) => {
      const hasClient = !!vehicle.client;
      return {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plateNumber: vehicle.plateNumber,
        bodyType: vehicle.bodyType,
        engineVolume: vehicle.engineVolume,
        vin: vehicle.vin,
        clientId: vehicle.clientId,
        hasClient: hasClient,
        clientInfo: hasClient
          ? {
              id: vehicle.client.id,
              firstName: vehicle.client.firstName,
              lastName: vehicle.client.lastName,
              discountPercent: vehicle.client.discountPercent,
            }
          : null,
      };
    });
  }

  /**
   * Получение информации об автомобиле вместе с данными о владельце
   */
  async getVehicleWithClient(
    warehouseId: string,
    vehicleId: string,
    userId: string
  ) {
    this.logger.log(
      `[getVehicleWithClient] Getting vehicle with client data: ${vehicleId}`
    );

    // Получаем автомобиль с информацией о клиенте
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId, isActive: true },
      relations: ['client'],
    });

    if (!vehicle) {
      throw new NotFoundException('Автомобиль не найден');
    }

    const hasClient = !!vehicle.client;
    return {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plateNumber,
      bodyType: vehicle.bodyType,
      engineVolume: vehicle.engineVolume,
      vin: vehicle.vin,
      clientId: vehicle.clientId,
      hasClient: hasClient,
      clientInfo: hasClient
        ? {
            id: vehicle.client.id,
            firstName: vehicle.client.firstName,
            lastName: vehicle.client.lastName,
            discountPercent: vehicle.client.discountPercent,
          }
        : null,
    };
  }
}
