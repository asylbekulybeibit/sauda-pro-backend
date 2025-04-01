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
    private readonly receiptItemRepository: Repository<ReceiptItem>
  ) {}

  /**
   * Поиск товаров по штрихкоду или названию
   */
  async searchProducts(warehouseId: string, query: string) {
    // Сначала пробуем найти точное соответствие по штрихкоду
    const barcode = await this.barcodeRepository.findOne({
      where: { code: query },
      relations: ['category'],
    });

    if (barcode) {
      // Если найден штрихкод, ищем товар на складе
      const product = await this.warehouseProductRepository.findOne({
        where: {
          warehouseId,
          barcodeId: barcode.id,
          isActive: true,
        },
        relations: ['barcode'],
      });

      if (product) {
        return [this.formatProductForResponse(product, barcode)];
      }
    }

    // Если не нашли по штрихкоду, ищем по названию
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
    const shift = await this.cashShiftRepository.findOne({
      where: {
        status: CashShiftStatus.OPEN,
        cashRegister: {
          warehouseId,
        },
      },
      relations: ['cashRegister', 'openedBy'],
      order: { startTime: 'DESC' },
    });

    if (!shift) {
      throw new NotFoundException('Открытая смена не найдена');
    }

    return {
      id: shift.id,
      startTime: shift.startTime,
      cashRegister: {
        id: shift.cashRegister.id,
        name: shift.cashRegister.name,
      },
      cashier: {
        id: shift.openedBy.id,
        name: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
      },
      initialAmount: shift.initialAmount,
      currentAmount: shift.currentAmount,
    };
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
    console.log('Received addItemDto:', {
      ...addItemDto,
      priceType: typeof addItemDto.price,
      quantityType: typeof addItemDto.quantity,
    });

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

    // Проверяем существование товара
    const product = await this.warehouseProductRepository.findOne({
      where: {
        id: addItemDto.warehouseProductId,
        warehouseId: warehouseId,
      },
      relations: ['barcode'],
    });

    if (!product) {
      throw new NotFoundException('Товар не найден');
    }

    // Ищем существующую позицию в чеке
    let receiptItem = await this.receiptItemRepository.findOne({
      where: {
        receiptId: receiptId,
        warehouseProductId: addItemDto.warehouseProductId,
      },
    });

    if (receiptItem) {
      // Обновляем существующую позицию
      console.log('Updating existing item. Original values:', {
        quantity: receiptItem.quantity,
        quantityType: typeof receiptItem.quantity,
        price: receiptItem.price,
        priceType: typeof receiptItem.price,
      });

      // Преобразуем входящие значения в числа
      const quantity = Number(addItemDto.quantity);
      const price = Number(addItemDto.price);
      const discountPercent = Number(addItemDto.discountPercent || 0);

      console.log('Converted values:', {
        quantity,
        quantityType: typeof quantity,
        price,
        priceType: typeof price,
        discountPercent,
        discountPercentType: typeof discountPercent,
      });

      receiptItem.quantity = quantity;
      receiptItem.price = price;
      receiptItem.discountPercent = discountPercent;

      // Выполняем расчеты
      const amount = Number((price * quantity).toFixed(2));
      const discountAmount = Number(
        (amount * (discountPercent / 100)).toFixed(2)
      );
      const finalAmount = Number((amount - discountAmount).toFixed(2));

      console.log('Calculated values:', {
        amount,
        amountType: typeof amount,
        discountAmount,
        discountAmountType: typeof discountAmount,
        finalAmount,
        finalAmountType: typeof finalAmount,
      });

      receiptItem.amount = amount;
      receiptItem.discountAmount = discountAmount;
      receiptItem.finalAmount = finalAmount;
    } else {
      // Создаем новую позицию
      console.log('Creating new item with values:', {
        quantity: addItemDto.quantity,
        quantityType: typeof addItemDto.quantity,
        price: addItemDto.price,
        priceType: typeof addItemDto.price,
      });

      // Преобразуем входящие значения в числа
      const quantity = Number(addItemDto.quantity);
      const price = Number(addItemDto.price);
      const discountPercent = Number(addItemDto.discountPercent || 0);

      // Создаем новую позицию с преобразованными значениями
      receiptItem = this.receiptItemRepository.create({
        receiptId: receiptId,
        warehouseProductId: addItemDto.warehouseProductId,
        name: product.barcode
          ? product.barcode.productName
          : 'Неизвестный товар',
        quantity,
        price,
        discountPercent,
        type: product.isService
          ? ReceiptItemType.SERVICE
          : ReceiptItemType.PRODUCT,
      });

      // Выполняем расчеты
      const amount = Number((price * quantity).toFixed(2));
      const discountAmount = Number(
        (amount * (discountPercent / 100)).toFixed(2)
      );
      const finalAmount = Number((amount - discountAmount).toFixed(2));

      console.log('Calculated values for new item:', {
        amount,
        amountType: typeof amount,
        discountAmount,
        discountAmountType: typeof discountAmount,
        finalAmount,
        finalAmountType: typeof finalAmount,
      });

      receiptItem.amount = amount;
      receiptItem.discountAmount = discountAmount;
      receiptItem.finalAmount = finalAmount;
    }

    // Сохраняем позицию
    console.log('Saving receipt item:', {
      quantity: receiptItem.quantity,
      quantityType: typeof receiptItem.quantity,
      price: receiptItem.price,
      priceType: typeof receiptItem.price,
      amount: receiptItem.amount,
      amountType: typeof receiptItem.amount,
      finalAmount: receiptItem.finalAmount,
      finalAmountType: typeof receiptItem.finalAmount,
    });

    const savedItem = await this.receiptItemRepository.save(receiptItem);

    // Обновляем итоги чека
    await this.updateReceiptTotals(receiptId);

    return savedItem;
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
}
