import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InventoryTransaction,
  TransactionType as EntityTransactionType,
} from '../entities/inventory-transaction.entity';
import { Product } from '../entities/product.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import {
  CreateTransactionDto,
  TransactionMetadata,
  TransactionType as DtoTransactionType,
} from '../dto/inventory/create-transaction.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateInventoryDto } from '../dto/create-inventory.dto';
import { Supplier } from '../entities/supplier.entity';
import { In } from 'typeorm';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly notificationsService: NotificationsService
  ) {}

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
      },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'User does not have manager access to this shop'
      );
    }
  }

  async createTransaction(
    userId: string,
    createTransactionDto: CreateTransactionDto
  ): Promise<InventoryTransaction> {
    const {
      shopId,
      productId,
      type,
      quantity,
      price,
      metadata,
      comment,
      note,
      description,
    } = createTransactionDto;

    await this.validateManagerAccess(userId, shopId);

    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['shop'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Проверяем достаточность остатков для уменьшающих операций
    if (
      [
        DtoTransactionType.SALE,
        DtoTransactionType.WRITE_OFF,
        DtoTransactionType.TRANSFER,
      ].includes(type) &&
      product.quantity < quantity
    ) {
      throw new BadRequestException(
        `Insufficient stock for ${type.toLowerCase()}. Available: ${
          product.quantity
        }, Requested: ${quantity}`
      );
    }

    // Для перемещений проверяем целевой магазин
    if (type === DtoTransactionType.TRANSFER && metadata?.toShopId) {
      const targetShop = await this.shopRepository.findOne({
        where: { id: metadata.toShopId },
      });

      if (!targetShop) {
        throw new NotFoundException('Target shop not found');
      }

      // Создаем уведомления о перемещении
      await this.notificationsService.createTransferInitiatedNotification(
        shopId,
        metadata.invoiceNumber || 'N/A',
        product.name,
        quantity,
        targetShop.name
      );
    }

    // Для приходов проверяем поставщика
    if (type === DtoTransactionType.PURCHASE && metadata?.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: metadata.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    }

    // Определяем изменение количества в зависимости от типа операции
    let quantityChange = 0;
    switch (type) {
      case DtoTransactionType.PURCHASE:
        quantityChange = quantity;
        break;
      case DtoTransactionType.SALE:
      case DtoTransactionType.WRITE_OFF:
      case DtoTransactionType.TRANSFER:
        quantityChange = -quantity;
        break;
      case DtoTransactionType.ADJUSTMENT:
        quantityChange = quantity - product.quantity;
        console.log(
          `Inventory ADJUSTMENT for product ${product.name} (ID: ${productId})`
        );
        console.log(
          `Current quantity=${product.quantity}, New quantity=${quantity}, Change=${quantityChange}`
        );

        // Если есть metadata с дополнительной информацией, логируем её
        if (metadata?.currentQuantity !== undefined) {
          console.log(
            `Reported current quantity from frontend: ${metadata.currentQuantity}`
          );
          console.log(
            `Actual difference in DB: ${quantity - product.quantity}`
          );

          // Если есть разница между значениями, логируем предупреждение
          if (Number(metadata.currentQuantity) !== product.quantity) {
            console.log(
              `WARNING: Frontend and database quantities differ! Frontend: ${metadata.currentQuantity}, DB: ${product.quantity}`
            );
          }
        }
        break;
    }

    // Преобразуем тип транзакции из DTO в тип сущности
    const entityType = EntityTransactionType[type];

    // Создаем транзакцию
    const transaction = this.transactionRepository.create({
      shopId: shopId,
      productId: productId,
      type: entityType,
      quantity,
      price,
      metadata,
      note: note || comment,
      comment,
      description,
      createdById: userId,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Обновляем количество товара
    await this.productRepository.update(productId, {
      quantity: () => `quantity + ${quantityChange}`,
      ...(price &&
      type === DtoTransactionType.PURCHASE &&
      metadata?.updatePurchasePrices
        ? { purchasePrice: price }
        : {}),
    });

    // Проверяем минимальные остатки после операции
    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (updatedProduct.quantity <= updatedProduct.minQuantity) {
      await this.notificationsService.createLowStockNotification(
        shopId,
        updatedProduct.name,
        updatedProduct.quantity
      );
    }

    return savedTransaction;
  }

  async getTransactions(
    userId: string,
    shopId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, shopId);

    const startTime = Date.now();
    console.log(
      `[${startTime}] Fetching transactions for shop: ${shopId}, user: ${userId}`
    );

    try {
      const transactions = await this.transactionRepository.find({
        where: { shopId, isActive: true },
        order: { createdAt: 'DESC' },
        relations: ['product', 'createdBy'],
      });

      const endTime = Date.now();
      console.log(
        `[${endTime}] Found ${transactions.length} transactions in ${
          endTime - startTime
        }ms`
      );

      // Логируем детали по транзакциям типа ADJUSTMENT (инвентаризация)
      const adjustments = transactions.filter(
        (tr) => tr.type === EntityTransactionType.ADJUSTMENT
      );
      console.log(
        `Found ${transactions.length} total transactions, ${adjustments.length} ADJUSTMENT transactions`
      );

      if (adjustments.length > 0) {
        console.log('Most recent adjustment transactions:');
        adjustments.slice(0, 5).forEach((adj, index) => {
          console.log(
            `[${index + 1}] ADJUSTMENT: productId=${adj.productId}, product=${
              adj.product?.name || 'unknown'
            }, quantity=${adj.quantity}, created=${adj.createdAt}`
          );
        });
      } else {
        console.log('No ADJUSTMENT transactions found for this shop');
      }

      // Проверка наличия продуктов в транзакциях
      const transactionsWithoutProduct = transactions.filter(
        (tr) => !tr.product
      );
      if (transactionsWithoutProduct.length > 0) {
        console.warn(
          `WARNING: ${transactionsWithoutProduct.length} transactions have no associated product information`
        );

        // Логируем первые 3 для отладки
        transactionsWithoutProduct.slice(0, 3).forEach((tr, index) => {
          console.warn(
            `Transaction with missing product [${index + 1}]: id=${
              tr.id
            }, productId=${tr.productId}, type=${tr.type}`
          );
        });
      }

      return transactions;
    } catch (error) {
      console.error(`Error fetching transactions for shop ${shopId}:`, error);
      throw error;
    }
  }

  async getProductTransactions(
    userId: string,
    productId: string
  ): Promise<InventoryTransaction[]> {
    const product = await this.productRepository.findOne({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.shopId);

    return this.transactionRepository.find({
      where: { productId },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getLowStockProducts(
    userId: string,
    shopId: string
  ): Promise<Product[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.productRepository
      .createQueryBuilder('product')
      .where('product.shopId = :shopId', { shopId })
      .andWhere('product.quantity <= product.minQuantity')
      .andWhere('product.isActive = true')
      .getMany();
  }

  async create(createInventoryDto: CreateInventoryDto, userId: string) {
    const { shopId, date, comment, items } = createInventoryDto;

    // Создаем транзакцию инвентаризации
    const transaction = await this.transactionRepository.save({
      type: EntityTransactionType.ADJUSTMENT,
      shopId,
      date,
      note: comment,
      createdById: userId,
    });

    // Обрабатываем каждый товар
    for (const item of items) {
      // Создаем транзакцию для каждого товара
      await this.createTransaction(userId, {
        shopId,
        productId: item.productId,
        type: DtoTransactionType.ADJUSTMENT,
        quantity: item.actualQuantity,
        comment: item.comment,
        metadata: {
          currentQuantity: item.currentQuantity,
          difference: item.difference,
        },
      });
    }

    return transaction;
  }

  async findAll(shopId: string) {
    return this.transactionRepository.find({
      where: {
        shopId,
        type: EntityTransactionType.ADJUSTMENT,
      },
      relations: ['product'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: number, shopId: string) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id: id.toString(),
        shopId,
        type: EntityTransactionType.ADJUSTMENT,
      },
      relations: ['product'],
    });

    if (!transaction) {
      throw new NotFoundException('Inventory check not found');
    }

    return transaction;
  }

  async getSales(
    userId: string,
    shopId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.transactionRepository.find({
      where: {
        shopId,
        type: EntityTransactionType.SALE,
      },
      relations: ['product', 'createdBy'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getReturns(
    userId: string,
    shopId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.transactionRepository.find({
      where: {
        shopId,
        type: EntityTransactionType.RETURN,
      },
      relations: ['product', 'createdBy'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getWriteOffs(
    userId: string,
    shopId: string
  ): Promise<InventoryTransaction[]> {
    console.log('Getting write-offs for shop:', shopId, 'user:', userId);

    await this.validateManagerAccess(userId, shopId);
    console.log('Manager access validated');

    const writeOffs = await this.transactionRepository.find({
      where: {
        shopId,
        type: EntityTransactionType.WRITE_OFF,
      },
      relations: ['product', 'createdBy'],
      order: {
        createdAt: 'DESC',
      },
    });

    console.log('Found write-offs:', writeOffs);
    return writeOffs;
  }

  async getPurchases(userId: string, shopId: string): Promise<any[]> {
    console.log('Getting purchases for shop:', shopId, 'user:', userId);

    await this.validateManagerAccess(userId, shopId);
    console.log('Manager access validated');

    const purchases = await this.transactionRepository.find({
      where: {
        shopId,
        type: EntityTransactionType.PURCHASE,
        isActive: true,
      },
      relations: ['product', 'createdBy'],
      order: {
        createdAt: 'DESC',
      },
    });

    console.log('Raw purchases from database:', JSON.stringify(purchases));

    // Получаем все уникальные ID поставщиков из транзакций
    const supplierIds = new Set<string>();
    purchases.forEach((purchase) => {
      const metadata = purchase.metadata || {};
      if (metadata.supplierId) {
        supplierIds.add(metadata.supplierId);
      }
    });

    // Загружаем информацию о поставщиках
    const suppliers = await this.supplierRepository.find({
      where: {
        id: In(Array.from(supplierIds)),
        shopId,
      },
    });

    // Создаем Map для быстрого доступа к поставщикам по ID
    const suppliersMap = new Map();
    suppliers.forEach((supplier) => {
      suppliersMap.set(supplier.id, supplier);
    });

    console.log('Loaded suppliers:', JSON.stringify(suppliers));

    // Группируем приходы по metadata.invoiceNumber и metadata.supplierId
    const purchaseGroups = new Map();

    purchases.forEach((purchase) => {
      const metadata = purchase.metadata || {};
      const invoiceNumber = metadata.invoiceNumber || 'unknown';
      const supplierId = metadata.supplierId || 'unknown';
      const key = `${invoiceNumber}-${supplierId}`;

      if (!purchaseGroups.has(key)) {
        // Получаем информацию о поставщике из Map или используем значение по умолчанию
        const supplier = suppliersMap.get(supplierId) || {
          name: 'Неизвестный поставщик',
        };

        purchaseGroups.set(key, {
          id: purchase.id,
          date: purchase.createdAt,
          invoiceNumber,
          supplierId,
          supplier: {
            name: supplier.name,
            address: supplier.address,
            phone: supplier.phone,
          },
          items: [],
          totalAmount: 0,
          status: 'completed',
        });
      }

      const group = purchaseGroups.get(key);
      group.items.push({
        productId: purchase.productId,
        product: purchase.product,
        quantity: purchase.quantity,
        price: purchase.price,
        total: purchase.quantity * purchase.price,
        serialNumber: metadata.serialNumber || null,
        expiryDate: metadata.expiryDate
          ? new Date(metadata.expiryDate).toISOString()
          : null,
        comment: purchase.note || null,
      });

      group.totalAmount += purchase.quantity * purchase.price;
    });

    const result = Array.from(purchaseGroups.values());
    console.log('Grouped purchases:', JSON.stringify(result));
    return result;
  }

  /**
   * Мягкое удаление прихода (установка isActive = false)
   * @param userId ID пользователя, выполняющего операцию
   * @param purchaseId ID прихода
   * @param shopId ID магазина
   */
  async deletePurchase(
    userId: string,
    purchaseId: string,
    shopId: string
  ): Promise<void> {
    console.log(`Deleting purchase ${purchaseId} for shop ${shopId}`);

    // Проверяем права доступа
    await this.validateManagerAccess(userId, shopId);

    // Находим все транзакции, связанные с этим приходом
    // Для этого нам нужно найти первую транзакцию, чтобы получить metadata.invoiceNumber и metadata.supplierId
    const mainTransaction = await this.transactionRepository.findOne({
      where: { id: purchaseId, shopId, isActive: true },
    });

    if (!mainTransaction) {
      throw new NotFoundException('Purchase not found');
    }

    const metadata = mainTransaction.metadata || {};
    const invoiceNumber = metadata.invoiceNumber;
    const supplierId = metadata.supplierId;

    if (!invoiceNumber || !supplierId) {
      throw new BadRequestException('Invalid purchase data');
    }

    // Находим все транзакции с тем же invoiceNumber и supplierId
    const transactions = await this.transactionRepository.find({
      where: {
        shopId,
        type: EntityTransactionType.PURCHASE,
        isActive: true,
        metadata: {
          invoiceNumber,
          supplierId,
        },
      },
    });

    if (transactions.length === 0) {
      throw new NotFoundException('Purchase transactions not found');
    }

    // Обновляем все найденные транзакции, устанавливая isActive = false
    for (const transaction of transactions) {
      transaction.isActive = false;
      await this.transactionRepository.save(transaction);

      // Обновляем количество товара (вычитаем)
      await this.productRepository.update(transaction.productId, {
        quantity: () => `quantity - ${transaction.quantity}`,
      });
    }

    console.log(
      `Successfully deleted purchase ${purchaseId} with ${transactions.length} transactions`
    );
  }
}
