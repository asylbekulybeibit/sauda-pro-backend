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
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Warehouse } from '../entities/warehouse.entity';
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
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly notificationsService: NotificationsService
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
      },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'User does not have manager access to this warehouse'
      );
    }
  }

  async createTransaction(
    userId: string,
    createTransactionDto: CreateTransactionDto
  ): Promise<InventoryTransaction> {
    const {
      warehouseId,
      warehouseProductId,
      type,
      quantity,
      price,
      metadata,
      comment,
      note,
      description,
    } = createTransactionDto;

    await this.validateManagerAccess(userId, warehouseId);

    const warehouseProduct = await this.warehouseProductRepository.findOne({
      where: { id: warehouseProductId },
      relations: ['barcode', 'warehouse'],
    });

    if (!warehouseProduct) {
      throw new NotFoundException('Product not found');
    }

    // Проверяем достаточность остатков для уменьшающих операций
    if (
      [
        DtoTransactionType.SALE,
        DtoTransactionType.WRITE_OFF,
        DtoTransactionType.TRANSFER,
      ].includes(type) &&
      warehouseProduct.quantity < quantity
    ) {
      throw new BadRequestException(
        `Insufficient stock for ${type.toLowerCase()}. Available: ${
          warehouseProduct.quantity
        }, Requested: ${quantity}`
      );
    }

    // Для перемещений проверяем целевой склад
    if (type === DtoTransactionType.TRANSFER && metadata?.toWarehouseId) {
      const targetWarehouse = await this.warehouseRepository.findOne({
        where: { id: metadata.toWarehouseId },
      });

      if (!targetWarehouse) {
        throw new NotFoundException('Target warehouse not found');
      }

      // Создаем уведомления о перемещении
      await this.notificationsService.createTransferInitiatedNotification(
        warehouseId,
        metadata.invoiceNumber || 'N/A',
        warehouseProduct.barcode.productName,
        quantity,
        targetWarehouse.name
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
        quantityChange = quantity - warehouseProduct.quantity;
        console.log(
          `Inventory ADJUSTMENT for product ${warehouseProduct.barcode.productName} (ID: ${warehouseProductId})`
        );
        console.log(
          `Current quantity=${warehouseProduct.quantity}, New quantity=${quantity}, Change=${quantityChange}`
        );

        // Если есть metadata с дополнительной информацией, логируем её
        if (metadata?.currentQuantity !== undefined) {
          console.log(
            `Reported current quantity from frontend: ${metadata.currentQuantity}`
          );
          console.log(
            `Actual difference in DB: ${quantity - warehouseProduct.quantity}`
          );

          // Если есть разница между значениями, логируем предупреждение
          if (Number(metadata.currentQuantity) !== warehouseProduct.quantity) {
            console.log(
              `WARNING: Frontend and database quantities differ! Frontend: ${metadata.currentQuantity}, DB: ${warehouseProduct.quantity}`
            );
          }
        }
        break;
    }

    // Преобразуем тип транзакции из DTO в тип сущности
    const entityType = EntityTransactionType[type];

    // Создаем транзакцию
    const transaction = this.transactionRepository.create({
      warehouseId: warehouseId,
      warehouseProductId: warehouseProductId,
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
    await this.warehouseProductRepository.update(warehouseProductId, {
      quantity: () => `quantity + ${quantityChange}`,
      ...(price &&
      type === DtoTransactionType.PURCHASE &&
      metadata?.updatePurchasePrices
        ? { purchasePrice: price }
        : {}),
    });

    // Проверяем минимальные остатки после операции
    const updatedProduct = await this.warehouseProductRepository.findOne({
      where: { id: warehouseProductId },
      relations: ['barcode'],
    });

    if (updatedProduct.quantity <= updatedProduct.minQuantity) {
      await this.notificationsService.createLowStockNotification(
        warehouseId,
        updatedProduct.barcode.productName,
        updatedProduct.quantity
      );
    }

    return savedTransaction;
  }

  async getTransactions(
    userId: string,
    warehouseId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, warehouseId);

    const startTime = Date.now();
    console.log(
      `[${startTime}] Fetching transactions for warehouse: ${warehouseId}, user: ${userId}`
    );

    try {
      const transactions = await this.transactionRepository.find({
        where: { warehouseId, isActive: true },
        order: { createdAt: 'DESC' },
        relations: [
          'warehouseProduct',
          'warehouseProduct.barcode',
          'createdBy',
        ],
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
        adjustments.forEach((adj, index) => {
          console.log(
            `[${index + 1}] ADJUSTMENT: warehouseProductId=${
              adj.warehouseProductId
            }, product=${
              adj.warehouseProduct?.barcode?.productName || 'unknown'
            }, quantity=${adj.quantity}`
          );
        });
      }

      // Проверяем наличие транзакций без связанных товаров
      const missingProducts = transactions.filter((tr) => !tr.warehouseProduct);
      if (missingProducts.length > 0) {
        console.log(
          `WARNING: Found ${missingProducts.length} transactions without linked products`
        );
        missingProducts.forEach((tr) => {
          console.log(
            `Transaction ${tr.id} missing product. Created at ${tr.createdAt}, warehouseProductId=${tr.warehouseProductId}, type=${tr.type}`
          );
        });
      }

      return transactions;
    } catch (error) {
      console.error(`ERROR fetching transactions: ${error.message}`);
      throw error;
    }
  }

  async getProductTransactions(
    userId: string,
    warehouseProductId: string
  ): Promise<InventoryTransaction[]> {
    // TODO: Implement proper access validation

    return this.transactionRepository.find({
      where: { warehouseProductId },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  async getLowStockProducts(
    userId: string,
    warehouseId: string
  ): Promise<WarehouseProduct[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.warehouseProductRepository
      .createQueryBuilder('wp')
      .where('wp.warehouseId = :warehouseId', { warehouseId })
      .andWhere('wp.quantity <= wp.minQuantity')
      .andWhere('wp.isActive = true')
      .getMany();
  }

  async create(createInventoryDto: CreateInventoryDto, userId: string) {
    // Legacy method - use createTransaction instead
    return null;
  }

  async findAll(warehouseId: string) {
    // Get all inventory adjustments for this warehouse
    return this.transactionRepository.find({
      where: {
        warehouseId,
        type: EntityTransactionType.ADJUSTMENT,
      },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  async findOne(id: number, warehouseId: string) {
    return this.transactionRepository.findOne({
      where: {
        id: String(id),
        warehouseId,
        type: EntityTransactionType.ADJUSTMENT,
      },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  async getSales(
    userId: string,
    warehouseId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.transactionRepository.find({
      where: {
        warehouseId,
        type: EntityTransactionType.SALE,
      },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  async getReturns(
    userId: string,
    warehouseId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.transactionRepository.find({
      where: {
        warehouseId,
        type: EntityTransactionType.RETURN,
      },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  async getWriteOffs(
    userId: string,
    warehouseId: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.transactionRepository.find({
      where: {
        warehouseId,
        type: EntityTransactionType.WRITE_OFF,
      },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  // Get purchases with additional details
  async getPurchases(userId: string, warehouseId: string): Promise<any[]> {
    await this.validateManagerAccess(userId, warehouseId);

    const purchases = await this.transactionRepository.find({
      where: {
        warehouseId,
        type: EntityTransactionType.PURCHASE,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });

    // Group by invoice number and supplier
    const groupedPurchases = new Map();

    for (const purchase of purchases) {
      // Check if invoice number and supplier ID exist
      const invoiceNumber = purchase.metadata?.invoiceNumber || 'NO_INVOICE';
      const supplierId = purchase.metadata?.supplierId;

      // Create a key for grouping
      const key = `${invoiceNumber}_${supplierId || 'NO_SUPPLIER'}`;

      if (!groupedPurchases.has(key)) {
        let supplierInfo = null;
        if (supplierId) {
          const supplier = await this.supplierRepository.findOne({
            where: { id: supplierId },
          });
          if (supplier) {
            supplierInfo = {
              id: supplier.id,
              name: supplier.name,
              contactName: supplier.contactName || supplier.contactPerson,
              phone: supplier.phone,
            };
          }
        }

        groupedPurchases.set(key, {
          id: purchase.id,
          invoiceNumber,
          date: purchase.createdAt,
          supplierId,
          supplier: supplierInfo,
          items: [],
          totalAmount: 0,
          createdBy: purchase.createdBy
            ? {
                id: purchase.createdBy.id,
                name: `${purchase.createdBy.firstName} ${purchase.createdBy.lastName}`,
              }
            : null,
        });
      }

      // Add purchase item to the group
      const group = groupedPurchases.get(key);
      group.items.push({
        id: purchase.id,
        warehouseProductId: purchase.warehouseProductId,
        warehouseProduct: purchase.warehouseProduct,
        quantity: purchase.quantity,
        price: purchase.price || 0,
        total: purchase.quantity * (purchase.price || 0),
        metadata: purchase.metadata,
        createdAt: purchase.createdAt,
      });

      // Update total amount
      group.totalAmount += purchase.quantity * (purchase.price || 0);
    }

    // Convert map to array and sort by date (newest first)
    return Array.from(groupedPurchases.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async deletePurchase(
    userId: string,
    purchaseId: string,
    warehouseId: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, warehouseId);

    const purchase = await this.transactionRepository.findOne({
      where: { id: purchaseId, warehouseId, isActive: true },
      relations: ['warehouseProduct'],
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    // Мягкое удаление транзакции
    purchase.isActive = false;
    await this.transactionRepository.save(purchase);

    // Возвращаем количество товара в исходное состояние
    await this.warehouseProductRepository.update(purchase.warehouseProductId, {
      quantity: () => `quantity - ${purchase.quantity}`,
    });
  }

  async getPurchasesByInvoice(
    userId: string,
    warehouseId: string,
    invoiceNumber: string,
    supplierId?: string
  ): Promise<InventoryTransaction[]> {
    await this.validateManagerAccess(userId, warehouseId);

    const whereCondition: any = {
      warehouseId,
      type: EntityTransactionType.PURCHASE,
      isActive: true,
      metadata: {},
    };

    if (invoiceNumber) {
      whereCondition.metadata = { invoiceNumber };
    }

    if (supplierId) {
      whereCondition.metadata = { ...whereCondition.metadata, supplierId };
    }

    return this.transactionRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
  }

  // Get count of out-of-stock products
  async getOutOfStockCount(warehouseId: string): Promise<number> {
    return this.warehouseProductRepository.count({
      where: {
        warehouseId,
        quantity: 0,
        isActive: true,
      },
    });
  }

  // Get count of low-stock products (below minQuantity)
  async getLowStockCount(warehouseId: string): Promise<number> {
    return this.warehouseProductRepository
      .createQueryBuilder('p')
      .where('p.warehouseId = :warehouseId', { warehouseId })
      .andWhere('p.quantity > 0')
      .andWhere('p.quantity <= p.minQuantity')
      .andWhere('p.isActive = true')
      .getCount();
  }
}
