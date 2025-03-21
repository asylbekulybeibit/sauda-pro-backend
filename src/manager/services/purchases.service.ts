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
import { Product } from '../entities/product.entity';
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

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(InventoryTransaction)
    private transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    private readonly notificationsService: NotificationsService
  ) {}

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, shopId, type: RoleType.MANAGER, isActive: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException('No access to this shop');
    }
  }

  private async createPurchaseTransaction(
    userId: string,
    purchase: Purchase,
    item: PurchaseItemDto,
    createPurchaseDto: CreatePurchaseDto
  ): Promise<InventoryTransaction> {
    // Проверяем существование товара
    const product = await this.productRepository.findOne({
      where: { id: item.productId, shopId: purchase.shopId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${item.productId} not found`
      );
    }

    // Строгое преобразование цены в число
    let price = 0;

    // После transform() в DTO, item.price всегда должно быть числом
    if (typeof item.price === 'number' && !isNaN(item.price)) {
      price = item.price;
    }

    console.log(
      `Создаем транзакцию для товара ${
        product.name
      } с ценой ${price}, исходный тип: ${typeof item.price}`
    );

    // Создаем транзакцию
    const transaction = new InventoryTransaction();
    transaction.shopId = purchase.shopId;
    transaction.productId = item.productId;
    transaction.type = TransactionType.PURCHASE;
    transaction.quantity = item.quantity;
    transaction.price = price; // Используем обработанную цену
    transaction.note = item.comment;
    transaction.createdById = userId;
    transaction.purchaseId = purchase.id;
    transaction.metadata = {
      supplierId: purchase.supplierId,
      invoiceNumber: purchase.invoiceNumber,
      serialNumber: item.serialNumber,
      expiryDate: item.expiryDate,
      price: price, // Дублируем обработанную цену в метаданных
    };

    console.log(`Транзакция с ценой ${transaction.price} готова к сохранению`);

    // Сохраняем и получаем сохраненную транзакцию
    const savedTransaction = await this.transactionRepository.save(transaction);
    console.log(`Транзакция сохранена: ${JSON.stringify(savedTransaction)}`);

    // Проверяем, правильно ли сохранилась цена
    if (savedTransaction.price !== price) {
      console.warn(
        `Предупреждение: сохраненная цена ${savedTransaction.price} отличается от исходной ${price}`
      );

      // Попытка обновить цену, если она не сохранилась правильно
      await this.transactionRepository.update(savedTransaction.id, { price });
    }

    return savedTransaction;
  }

  async createPurchase(
    userId: string,
    createPurchaseDto: CreatePurchaseDto
  ): Promise<PurchaseWithItems> {
    console.log(
      'Creating purchase with data:',
      JSON.stringify(createPurchaseDto, null, 2)
    );
    await this.validateManagerAccess(userId, createPurchaseDto.shopId);

    // Проверяем существование поставщика
    const supplier = await this.supplierRepository.findOne({
      where: { id: createPurchaseDto.supplierId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Создаем новую запись для покупки
    const purchase = new Purchase();
    purchase.shopId = createPurchaseDto.shopId;
    purchase.supplierId = createPurchaseDto.supplierId;
    purchase.invoiceNumber = createPurchaseDto.invoiceNumber;
    purchase.date = createPurchaseDto.date;
    purchase.comment = createPurchaseDto.comment;
    purchase.createdById = userId;
    purchase.status = PurchaseStatus.COMPLETED; // Все новые приходы имеют статус COMPLETED

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
    const savedPurchase = await this.purchaseRepository.save(purchase);
    console.log('Saved purchase:', savedPurchase);

    // Создаем транзакции в инвентаре для всех товаров
    for (const item of createPurchaseDto.items) {
      await this.createPurchaseTransaction(
        userId,
        savedPurchase,
        item,
        createPurchaseDto
      );
    }

    // Обновляем цены товаров, если нужно
    if (
      createPurchaseDto.updatePrices ||
      createPurchaseDto.updatePurchasePrices
    ) {
      await this.updateProductPrices(createPurchaseDto);
    }

    // Перезагружаем покупку с обновленными данными
    return this.findOne(savedPurchase.id, createPurchaseDto.shopId);
  }

  private async updateProductPrices(
    createPurchaseDto: CreatePurchaseDto
  ): Promise<void> {
    for (const item of createPurchaseDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, isActive: true },
      });

      if (product) {
        // Получаем числовое представление цены
        let itemPrice = 0;

        // После transform() в DTO, item.price всегда должно быть числом
        if (typeof item.price === 'number' && !isNaN(item.price)) {
          itemPrice = item.price;
        }

        console.log(
          `Обновление цен для товара ${product.name}: закупочная цена = ${itemPrice}`
        );

        // Обновляем закупочную цену, если нужно
        if (createPurchaseDto.updatePurchasePrices) {
          product.purchasePrice = itemPrice;
          console.log(`Обновлена закупочная цена: ${product.purchasePrice}`);
        }

        // Обновляем цену продажи, если нужно
        if (createPurchaseDto.updatePrices) {
          // Здесь можно добавить логику расчета цены продажи на основе закупочной
          // Например, добавить наценку
          const markup = 1.3; // 30% наценка
          product.sellingPrice = itemPrice * markup;
          console.log(`Обновлена цена продажи: ${product.sellingPrice}`);
        }

        await this.productRepository.save(product);
      }
    }
  }

  async findAll(userId: string, shopId: string): Promise<PurchaseWithItems[]> {
    await this.validateManagerAccess(userId, shopId);

    // Get all purchases with related data
    const purchases = await this.purchaseRepository.find({
      where: { shopId, isActive: true },
      relations: [
        'supplier',
        'transactions',
        'transactions.product',
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
            productId: transaction.productId,
            product: {
              name: transaction.product.name,
              sku: transaction.product.sku,
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

  async findOne(id: string, shopId: string): Promise<PurchaseWithItems> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, shopId, isActive: true },
      relations: [
        'supplier',
        'transactions',
        'transactions.product',
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
        productId: transaction.productId,
        product: {
          name: transaction.product.name,
          sku: transaction.product.sku,
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
    shopId: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, shopId);

    const purchase = await this.purchaseRepository.findOne({
      where: { id, shopId, isActive: true },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    // Soft delete
    purchase.isActive = false;
    await this.purchaseRepository.save(purchase);
  }
}
