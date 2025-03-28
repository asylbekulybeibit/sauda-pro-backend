import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase, PurchaseStatus } from '../entities/purchase.entity';
import {
  InventoryTransaction,
  TransactionType,
} from '../entities/inventory-transaction.entity';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Supplier } from '../entities/supplier.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import {
  CreatePurchaseDto,
  PurchaseItemDto,
  UpdatePurchaseDto,
} from '../dto/purchases/create-purchase.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { PurchaseWithItems } from '../interfaces/purchase-with-items.interface';
import { LabelsService } from '../services/labels.service';
import { LabelTemplate } from '../entities/label-template.entity';
import { PriceHistory, PriceType } from '../entities/price-history.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(InventoryTransaction)
    private transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(WarehouseProduct)
    private warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(LabelTemplate)
    private labelTemplateRepository: Repository<LabelTemplate>,
    @InjectRepository(PriceHistory)
    private priceHistoryRepository: Repository<PriceHistory>,
    private readonly notificationsService: NotificationsService,
    private readonly labelsService: LabelsService
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, warehouseId, type: RoleType.MANAGER, isActive: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException('No access to this warehouse');
    }
  }

  private async createPurchaseTransaction(
    userId: string,
    purchase: Purchase,
    item: PurchaseItemDto,
    createPurchaseDto: CreatePurchaseDto
  ): Promise<InventoryTransaction> {
    console.log(
      `[createPurchaseTransaction] Creating transaction for product ${item.productId} in purchase ${purchase.id}`
    );

    // Проверяем связь с поставщиком
    console.log(
      `[createPurchaseTransaction] Purchase supplierId: ${purchase.supplierId}`
    );

    // Проверяем существование товара
    const warehouseProduct = await this.warehouseProductRepository.findOne({
      where: {
        id: item.productId,
        warehouseId: purchase.warehouseId,
        isActive: true,
      },
      relations: ['barcode', 'barcode.category'],
    });

    if (!warehouseProduct) {
      console.error(
        `[createPurchaseTransaction] ERROR: Product with ID ${item.productId} not found`
      );
      throw new NotFoundException(
        `Product with ID ${item.productId} not found`
      );
    }

    console.log(
      `[createPurchaseTransaction] Product found: ${warehouseProduct.barcode.productName} (ID: ${warehouseProduct.id})`
    );

    // Строгое преобразование цены в число
    let price = 0;

    // После transform() в DTO, item.price всегда должно быть числом
    if (typeof item.price === 'number' && !isNaN(item.price)) {
      price = item.price;
    }

    console.log(
      `[createPurchaseTransaction] Создаем транзакцию для товара ${
        warehouseProduct.barcode.productName
      } с ценой ${price}, исходный тип: ${typeof item.price}`
    );

    // Создаем транзакцию
    const transaction = new InventoryTransaction();
    transaction.warehouseId = purchase.warehouseId;
    transaction.warehouseProductId = item.productId;
    transaction.type = TransactionType.PURCHASE;
    transaction.quantity = item.quantity;
    transaction.price = price; // Используем обработанную цену
    transaction.note = item.comment;
    transaction.createdById = userId;
    transaction.purchaseId = purchase.id;

    // Проверяем, не является ли supplierId null или undefined перед добавлением в метаданные
    const metadata: any = {
      invoiceNumber: purchase.invoiceNumber || '',
      serialNumber: item.serialNumber || '',
      expiryDate: item.expiryDate,
      price: price, // Дублируем обработанную цену в метаданных
    };

    // Добавляем supplierId только если он существует
    if (purchase.supplierId) {
      metadata.supplierId = purchase.supplierId;
    }

    transaction.metadata = metadata;

    console.log(`[createPurchaseTransaction] Транзакция подготовлена:`, {
      warehouseProductId: transaction.warehouseProductId,
      quantity: transaction.quantity,
      price: transaction.price,
      supplierId: metadata.supplierId,
    });

    // Сохраняем и получаем сохраненную транзакцию
    try {
      const savedTransaction =
        await this.transactionRepository.save(transaction);
      console.log(
        `[createPurchaseTransaction] Транзакция успешно сохранена с ID: ${savedTransaction.id}`
      );

      // Проверяем, правильно ли сохранилась цена
      if (savedTransaction.price !== price) {
        console.warn(
          `[createPurchaseTransaction] Предупреждение: сохраненная цена ${savedTransaction.price} отличается от исходной ${price}`
        );

        // Попытка обновить цену, если она не сохранилась правильно
        await this.transactionRepository.update(savedTransaction.id, { price });
      }

      return savedTransaction;
    } catch (error) {
      console.error(
        `[createPurchaseTransaction] ERROR saving transaction:`,
        error
      );
      throw error;
    }
  }

  async createPurchase(
    userId: string,
    createPurchaseDto: CreatePurchaseDto
  ): Promise<PurchaseWithItems> {
    console.log(
      '[PurchasesService] Creating purchase with data:',
      JSON.stringify(createPurchaseDto, null, 2)
    );

    // Явно логируем наличие поставщика и номера накладной
    console.log('[PurchasesService] supplierId:', createPurchaseDto.supplierId);
    console.log(
      '[PurchasesService] invoiceNumber:',
      createPurchaseDto.invoiceNumber
    );

    await this.validateManagerAccess(userId, createPurchaseDto.warehouseId);

    // Устанавливаем createdById, чтобы использовать его при сохранении истории цен
    createPurchaseDto.createdById = userId;

    // Проверяем существование поставщика только если указан ID
    if (createPurchaseDto.supplierId) {
      console.log(
        '[PurchasesService] Checking supplier existence for ID:',
        createPurchaseDto.supplierId
      );

      const supplier = await this.supplierRepository.findOne({
        where: { id: createPurchaseDto.supplierId, isActive: true },
      });

      if (!supplier) {
        console.log(
          '[PurchasesService] ERROR: Supplier not found with ID:',
          createPurchaseDto.supplierId
        );
        throw new NotFoundException('Supplier not found');
      } else {
        console.log('[PurchasesService] Supplier found:', supplier.name);
      }
    } else {
      console.log('[PurchasesService] Creating purchase without supplier');
    }

    // Если включена проверка на дубликаты, проверяем дубликаты товаров
    if (createPurchaseDto.checkDuplicates) {
      await this.checkForDuplicates(createPurchaseDto);
    }

    // Создаем новую запись для покупки
    const purchase = new Purchase();
    purchase.warehouseId = createPurchaseDto.warehouseId;
    purchase.supplierId = createPurchaseDto.supplierId || null;
    purchase.invoiceNumber = createPurchaseDto.invoiceNumber || '';
    purchase.date = createPurchaseDto.date;
    purchase.comment = createPurchaseDto.comment;
    purchase.createdById = userId;
    purchase.status = PurchaseStatus.COMPLETED; // Все новые приходы имеют статус COMPLETED

    console.log('[PurchasesService] Purchase entity created:', {
      warehouseId: purchase.warehouseId,
      supplierId: purchase.supplierId,
      invoiceNumber: purchase.invoiceNumber,
      date: purchase.date,
      status: purchase.status,
    });

    // Вычисляем общую сумму и общее количество товаров
    let totalAmount = 0;
    let totalItems = 0;
    for (const item of createPurchaseDto.items) {
      // После transform() в DTO, item.price всегда должно быть числом
      let itemPrice = 0;

      if (typeof item.price === 'number' && !isNaN(item.price)) {
        itemPrice = item.price;
      }

      console.log(
        `Товар ${item.productId}: цена = ${itemPrice} (исходная: ${
          item.price
        }, тип: ${typeof item.price}), количество = ${item.quantity}`
      );

      // Используем преобразованную цену для расчетов
      totalAmount += itemPrice * item.quantity;
      totalItems += item.quantity;
    }
    purchase.totalAmount = totalAmount;
    purchase.totalItems = totalItems;

    console.log(
      `Calculated totalAmount: ${totalAmount}, totalItems: ${totalItems}`
    );

    // Сохраняем покупку
    console.log('[PurchasesService] Saving purchase to database...');
    let savedPurchase;
    try {
      savedPurchase = await this.purchaseRepository.save(purchase);
      console.log(
        '[PurchasesService] Purchase saved successfully:',
        savedPurchase
      );
    } catch (error) {
      console.error('[PurchasesService] ERROR saving purchase:', error);
      // Проверяем тип ошибки и логируем полезную информацию
      if (error.code === '23502') {
        // PostgreSQL not-null constraint violation
        console.error(
          '[PurchasesService] NOT NULL constraint violated. Check entity definition and database schema.'
        );
        console.error(
          '[PurchasesService] Constraint details:',
          error.detail || error.message
        );
      }
      // Перебрасываем ошибку дальше
      throw error;
    }

    // Создаем транзакции в инвентаре для всех товаров
    for (const item of createPurchaseDto.items) {
      try {
        await this.createPurchaseTransaction(
          userId,
          savedPurchase,
          item,
          createPurchaseDto
        );
      } catch (error) {
        console.error(
          `[PurchasesService] ERROR creating transaction for item ${item.productId}:`,
          error
        );
        throw error;
      }
    }

    // Обновляем цены товаров, если нужно
    if (
      createPurchaseDto.updatePrices ||
      createPurchaseDto.updatePurchasePrices
    ) {
      await this.updateProductPrices(createPurchaseDto);
    }

    // Создаем этикетки, если нужно
    if (createPurchaseDto.createLabels) {
      try {
        await this.generateLabelsForPurchase(userId, createPurchaseDto);
      } catch (error) {
        console.error('Ошибка при создании этикеток:', error);
        // Не прерываем основную операцию в случае ошибки создания этикеток
      }
    }

    // Перезагружаем покупку с обновленными данными
    return this.findOne(savedPurchase.id, createPurchaseDto.warehouseId);
  }

  private async updateProductPrices(
    createPurchaseDto: CreatePurchaseDto
  ): Promise<void> {
    console.log(`[updateProductPrices] Начинаем обновление цен товаров`);
    console.log(
      `[updateProductPrices] Параметр updatePrices: ${createPurchaseDto.updatePrices}`
    );
    console.log(
      `[updateProductPrices] Параметр updatePurchasePrices: ${createPurchaseDto.updatePurchasePrices}`
    );
    console.log(
      `[updateProductPrices] Всего товаров для обработки: ${createPurchaseDto.items.length}`
    );

    // Получаем наценку и тип наценки из DTO или используем значения по умолчанию
    const markupValue =
      createPurchaseDto.markup !== undefined ? createPurchaseDto.markup : 30; // По умолчанию 30
    const markupType = createPurchaseDto.markupType || 'percentage'; // По умолчанию процентная наценка

    if (markupType === 'percentage') {
      // Для процентной наценки преобразуем проценты в множитель (30% -> 1.3)
      const markup = 1 + markupValue / 100;
      console.log(
        `[updateProductPrices] Используется процентная наценка: ${markupValue}% (множитель ${markup})`
      );
    } else {
      // Для фиксированной наценки просто выводим значение
      console.log(
        `[updateProductPrices] Используется фиксированная наценка: ${markupValue}`
      );
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of createPurchaseDto.items) {
      console.log(
        `[updateProductPrices] Обработка товара с ID ${item.productId}`
      );

      const warehouseProduct = await this.warehouseProductRepository.findOne({
        where: {
          id: item.productId,
          warehouseId: createPurchaseDto.warehouseId,
          isActive: true,
        },
        relations: ['barcode', 'barcode.category'],
      });

      if (warehouseProduct) {
        console.log(
          `[updateProductPrices] Товар найден: ${warehouseProduct.barcode.productName} (ID: ${warehouseProduct.id})`
        );
        console.log(
          `[updateProductPrices] Текущая закупочная цена: ${warehouseProduct.purchasePrice}`
        );
        console.log(
          `[updateProductPrices] Текущая цена продажи: ${warehouseProduct.sellingPrice}`
        );

        // Получаем числовое представление цены
        let itemPrice = 0;

        // После transform() в DTO, item.price всегда должно быть числом
        if (typeof item.price === 'number' && !isNaN(item.price)) {
          itemPrice = item.price;
        }

        console.log(
          `[updateProductPrices] Цена из прихода для товара ${
            warehouseProduct.barcode.productName
          }: ${itemPrice} (тип: ${typeof item.price})`
        );

        let priceUpdated = false;

        // Обновляем закупочную цену, если нужно
        if (createPurchaseDto.updatePurchasePrices) {
          console.log(
            `[updateProductPrices] Обновляем закупочную цену для товара ${warehouseProduct.barcode.productName}`
          );
          console.log(
            `[updateProductPrices] Старая закупочная цена: ${warehouseProduct.purchasePrice}`
          );

          // Сохраняем старую цену
          const oldPurchasePrice = warehouseProduct.purchasePrice;

          // Устанавливаем новую цену
          warehouseProduct.purchasePrice = itemPrice;

          console.log(
            `[updateProductPrices] Новая закупочная цена: ${warehouseProduct.purchasePrice}`
          );

          // Сохраняем изменение в истории цен
          await this.priceHistoryRepository.save({
            oldPrice: oldPurchasePrice,
            newPrice: itemPrice,
            reason: 'Обновление через приход',
            warehouseProductId: warehouseProduct.id,
            changedById: createPurchaseDto.createdById || 'system',
            priceType: PriceType.PURCHASE,
          });

          priceUpdated = true;
        } else {
          console.log(
            `[updateProductPrices] Пропускаем обновление закупочной цены (флаг выключен)`
          );
        }

        // Обновляем цену продажи, если нужно
        if (createPurchaseDto.updatePrices) {
          console.log(
            `[updateProductPrices] Обновляем цену продажи для товара ${warehouseProduct.barcode.productName}`
          );
          console.log(
            `[updateProductPrices] Старая цена продажи: ${warehouseProduct.sellingPrice}`
          );

          // Сохраняем старую цену
          const oldSellingPrice = warehouseProduct.sellingPrice;

          // Рассчитываем новую цену продажи в зависимости от типа наценки
          let newSellingPrice: number;
          if (markupType === 'percentage') {
            // Для процентной наценки: закупочная * (1 + процент/100)
            const markup = 1 + markupValue / 100;
            newSellingPrice = itemPrice * markup;
            console.log(
              `[updateProductPrices] Расчет: ${itemPrice} * ${markup} (${markupValue}%)`
            );
          } else {
            // Для фиксированной наценки: закупочная + фиксированная сумма
            newSellingPrice = itemPrice + markupValue;
            console.log(
              `[updateProductPrices] Расчет: ${itemPrice} + ${markupValue}`
            );
          }

          warehouseProduct.sellingPrice = newSellingPrice;
          console.log(
            `[updateProductPrices] Новая цена продажи: ${warehouseProduct.sellingPrice}`
          );

          // Сохраняем изменение в истории цен
          await this.priceHistoryRepository.save({
            oldPrice: oldSellingPrice,
            newPrice: newSellingPrice,
            reason: 'Обновление через приход',
            warehouseProductId: warehouseProduct.id,
            changedById: createPurchaseDto.createdById || 'system',
            priceType: PriceType.SELLING,
          });

          priceUpdated = true;
        } else {
          console.log(
            `[updateProductPrices] Пропускаем обновление цены продажи (флаг выключен)`
          );
        }

        if (priceUpdated) {
          console.log(
            `[updateProductPrices] Сохраняем обновленные цены для товара ${warehouseProduct.barcode.productName}`
          );
          await this.warehouseProductRepository.save(warehouseProduct);
          updatedCount++;
        } else {
          console.log(
            `[updateProductPrices] Нет изменений цен для товара ${warehouseProduct.barcode.productName}`
          );
          skippedCount++;
        }
      } else {
        console.log(
          `[updateProductPrices] Товар с ID ${item.productId} не найден в магазине ${createPurchaseDto.warehouseId}`
        );
        skippedCount++;
      }
    }

    console.log(
      `[updateProductPrices] Обновление цен завершено. Обновлено товаров: ${updatedCount}, пропущено: ${skippedCount}`
    );
  }

  async findAll(
    userId: string,
    warehouseId: string
  ): Promise<PurchaseWithItems[]> {
    await this.validateManagerAccess(userId, warehouseId);

    // Get all purchases with related data
    const purchases = await this.purchaseRepository.find({
      where: { warehouseId, isActive: true },
      relations: [
        'supplier',
        'transactions',
        'transactions.warehouseProduct',
        'transactions.warehouseProduct.barcode',
        'createdBy',
      ],
      order: { date: 'DESC' },
    });

    // Transform data for frontend
    return purchases.map((purchase) => {
      // Проверка и логирование транзакций
      if (purchase.transactions.length > 0) {
        console.log(
          `Покупка ${purchase.id} содержит ${purchase.transactions.length} транзакций`
        );
        purchase.transactions.forEach((t, i) => {
          console.log(
            `Транзакция ${i + 1}: id=${t.id}, цена=${t.price}, количество=${
              t.quantity
            }, метаданные=${JSON.stringify(t.metadata)}`
          );

          // Проверяем наличие цены в транзакции
          if (t.price === null || t.price === undefined) {
            // Попытка восстановить цену из метаданных
            if (t.metadata && t.metadata.price) {
              console.log(
                `Восстанавливаем цену из метаданных: ${t.metadata.price}`
              );
              t.price = t.metadata.price;
            } else {
              console.warn(`Транзакция без цены: ${t.id}`);
            }
          }
        });
      } else {
        console.warn(`Покупка ${purchase.id} не содержит транзакций`);
      }

      // Все покупки имеют статус COMPLETED и используют транзакции
      const items =
        purchase.transactions?.map((transaction) => {
          const price =
            typeof transaction.price === 'number'
              ? transaction.price
              : transaction.metadata?.price || 0;

          return {
            productId: transaction.warehouseProductId,
            product: {
              name: transaction.warehouseProduct.barcode.productName,
            },
            quantity: transaction.quantity,
            price: price, // Используем цену из транзакции или метаданных
            total: transaction.quantity * price, // Правильный расчет суммы
            serialNumber: transaction.metadata?.serialNumber,
            expiryDate: transaction.metadata?.expiryDate,
            comment: transaction.note,
          };
        }) || [];

      // Пересчитываем общую сумму и количество на основе актуальных данных
      const totalAmount = items.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const totalItems = items.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0
      );

      const createdByInfo = purchase.createdBy
        ? {
            id: purchase.createdBy.id,
            name:
              purchase.createdBy.firstName && purchase.createdBy.lastName
                ? `${purchase.createdBy.firstName} ${purchase.createdBy.lastName}`
                : purchase.createdBy.phone,
            firstName: purchase.createdBy.firstName,
            lastName: purchase.createdBy.lastName,
            email: purchase.createdBy.email,
          }
        : undefined;

      const result: PurchaseWithItems = {
        ...purchase,
        totalAmount: totalAmount, // Обновляем общую сумму
        totalItems: totalItems, // Обновляем общее количество
        items,
        createdBy: purchase.createdBy,
      };

      return result;
    });
  }

  async findOne(id: string, warehouseId: string): Promise<PurchaseWithItems> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, warehouseId, isActive: true },
      relations: [
        'supplier',
        'transactions',
        'transactions.warehouseProduct',
        'transactions.warehouseProduct.barcode',
        'createdBy',
      ],
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    // Проверка и логирование транзакций
    if (purchase.transactions.length > 0) {
      console.log(
        `Покупка ${purchase.id} содержит ${purchase.transactions.length} транзакций`
      );
      purchase.transactions.forEach((t, i) => {
        console.log(
          `Транзакция ${i + 1}: id=${t.id}, цена=${t.price}, количество=${
            t.quantity
          }, метаданные=${JSON.stringify(t.metadata)}`
        );

        // Проверяем наличие цены в транзакции
        if (t.price === null || t.price === undefined) {
          // Попытка восстановить цену из метаданных
          if (t.metadata && t.metadata.price) {
            console.log(
              `Восстанавливаем цену из метаданных: ${t.metadata.price}`
            );
            t.price = t.metadata.price;
          } else {
            console.warn(`Транзакция без цены: ${t.id}`);
          }
        }
      });
    } else {
      console.warn(`Покупка ${purchase.id} не содержит транзакций`);
    }

    // Все покупки имеют статус COMPLETED и используют транзакции
    const items = purchase.transactions.map((transaction) => {
      const price =
        typeof transaction.price === 'number'
          ? transaction.price
          : transaction.metadata?.price || 0;

      return {
        productId: transaction.warehouseProductId,
        product: {
          name: transaction.warehouseProduct.barcode.productName,
        },
        quantity: transaction.quantity,
        price: price, // Используем цену из транзакции или метаданных
        total: transaction.quantity * price, // Правильный расчет суммы
        serialNumber: transaction.metadata?.serialNumber,
        expiryDate: transaction.metadata?.expiryDate,
        comment: transaction.note,
      };
    });

    // Пересчитываем общую сумму и количество на основе актуальных данных
    const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalItems = items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    const result: PurchaseWithItems = {
      ...purchase,
      totalAmount: totalAmount, // Обновляем общую сумму
      totalItems: totalItems, // Обновляем общее количество
      items,
      createdBy: purchase.createdBy,
    };

    return result;
  }

  async deletePurchase(
    userId: string,
    id: string,
    warehouseId: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, warehouseId);

    const purchase = await this.purchaseRepository.findOne({
      where: { id, warehouseId, isActive: true },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    // Soft delete
    purchase.isActive = false;
    await this.purchaseRepository.save(purchase);
  }

  // Метод для генерации этикеток для покупки
  private async generateLabelsForPurchase(
    userId: string,
    createPurchaseDto: CreatePurchaseDto
  ): Promise<void> {
    // Находим первый доступный шаблон этикетки для склада
    const defaultTemplate = await this.labelTemplateRepository.findOne({
      where: {
        warehouseId: createPurchaseDto.warehouseId,
        isActive: true,
      },
    });

    if (!defaultTemplate) {
      console.warn(
        'Шаблон этикетки не найден для склада',
        createPurchaseDto.warehouseId
      );
      return;
    }

    // Формируем запрос на создание этикеток
    const labelsRequest = {
      warehouseId: createPurchaseDto.warehouseId,
      templateId: defaultTemplate.id,
      products: createPurchaseDto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    // Создаем этикетки
    await this.labelsService.generateBatchLabels(
      userId,
      createPurchaseDto.warehouseId,
      labelsRequest
    );

    console.log('Этикетки успешно созданы для покупки');
  }

  // Метод для проверки дубликатов товаров
  private async checkForDuplicates(
    createPurchaseDto: CreatePurchaseDto
  ): Promise<void> {
    console.log(`[checkForDuplicates] Начало проверки дубликатов товаров`);
    console.log(
      `[checkForDuplicates] Всего товаров в запросе: ${createPurchaseDto.items.length}`
    );

    // Создаем Map для отслеживания дубликатов
    const duplicateCheck = new Map<string, PurchaseItemDto[]>();

    // Заполняем Map, группируя элементы по productId
    for (const item of createPurchaseDto.items) {
      if (!duplicateCheck.has(item.productId)) {
        duplicateCheck.set(item.productId, []);
      }
      duplicateCheck.get(item.productId)?.push(item);
    }

    // Находим товары с дубликатами
    const duplicates: Array<{ productId: string; count: number }> = [];
    duplicateCheck.forEach((items, productId) => {
      if (items.length > 1) {
        duplicates.push({ productId, count: items.length });
        console.log(
          `[checkForDuplicates] Товар ${productId} дублируется ${items.length} раз`
        );
      }
    });

    // Если есть дубликаты, объединяем их (суммируем количество)
    if (duplicates.length > 0) {
      console.log(
        `[checkForDuplicates] Обнаружены дубликаты товаров: ${JSON.stringify(
          duplicates
        )}`
      );
      console.log(
        `[checkForDuplicates] Всего обнаружено ${duplicates.length} видов товаров с дубликатами`
      );

      // Собираем уникальные элементы с объединенным количеством
      const uniqueItems: PurchaseItemDto[] = [];
      duplicateCheck.forEach((items, productId) => {
        if (items.length === 1) {
          // Если только один элемент, добавляем его как есть
          uniqueItems.push(items[0]);
        } else {
          // Если несколько элементов, объединяем их
          let totalQuantity = 0;
          let lastPrice = 0;
          let lastComment = '';
          let lastSerialNumber = '';
          let lastExpiryDate: Date | undefined;

          // Проходим по всем дубликатам, суммируя количество и беря последние значения для других полей
          for (const item of items) {
            totalQuantity += item.quantity;
            if (item.price !== undefined) lastPrice = item.price;
            if (item.comment) lastComment = item.comment;
            if (item.serialNumber) lastSerialNumber = item.serialNumber;
            if (item.expiryDate) lastExpiryDate = item.expiryDate;

            console.log(
              `[checkForDuplicates] Дубликат товара ${productId}: количество ${item.quantity}, цена ${item.price}`
            );
          }

          // Создаем объединенный элемент
          const consolidatedItem: PurchaseItemDto = {
            productId,
            quantity: totalQuantity,
            price: lastPrice,
            serialNumber: lastSerialNumber,
            expiryDate: lastExpiryDate,
            comment: lastComment
              ? `${lastComment} (объединены дубликаты)`
              : '(объединены дубликаты)',
          };

          uniqueItems.push(consolidatedItem);
          console.log(
            `[checkForDuplicates] Объединен товар ${productId}: итоговое количество ${totalQuantity}, цена ${lastPrice}`
          );
        }
      });

      // Заменяем список товаров в DTO на уникальные
      createPurchaseDto.items = uniqueItems;
      console.log(
        `[checkForDuplicates] После объединения дубликатов: ${uniqueItems.length} уникальных товаров вместо ${createPurchaseDto.items.length} исходных`
      );
    } else {
      console.log(`[checkForDuplicates] Дубликаты товаров не обнаружены`);
    }
  }
}
