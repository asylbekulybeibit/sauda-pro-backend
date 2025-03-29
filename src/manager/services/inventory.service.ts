import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
import { CreateInventoryDto } from '../dto/create-inventory.dto';
import { Supplier } from '../entities/supplier.entity';

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
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<string> {
    console.log('[InventoryService] Validating manager access:', {
      userId,
      warehouseId,
      timestamp: new Date().toISOString(),
    });

    // Сначала проверяем прямой доступ к складу
    const directAccess = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (directAccess) {
      console.log('[InventoryService] Direct warehouse access found:', {
        userId,
        warehouseId,
        role: {
          id: directAccess.id,
          type: directAccess.type,
          warehouseId: directAccess.warehouseId,
        },
      });
      return warehouseId;
    }

    // Если нет прямого доступа, ищем любую активную роль менеджера для этого пользователя
    const anyManagerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!anyManagerRole || !anyManagerRole.warehouse) {
      console.warn('[InventoryService] No manager role found:', {
        userId,
        warehouseId,
        timestamp: new Date().toISOString(),
      });
      throw new ForbiddenException('У вас нет прав менеджера склада');
    }

    console.log(
      '[InventoryService] Found manager role for different warehouse:',
      {
        userId,
        requestedWarehouseId: warehouseId,
        actualWarehouseId: anyManagerRole.warehouse.id,
      }
    );

    // Возвращаем ID склада, к которому у пользователя есть доступ
    return anyManagerRole.warehouse.id;
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
    console.log('[InventoryService] Creating transaction with metadata:', {
      metadata,
      type,
      quantity,
      warehouseProductId,
    });

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

    console.log('[InventoryService] Transaction before save:', {
      id: transaction.id,
      type: transaction.type,
      metadata: transaction.metadata,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    console.log('[InventoryService] Saved transaction:', {
      id: savedTransaction.id,
      type: savedTransaction.type,
      metadata: savedTransaction.metadata,
    });

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

   

    return savedTransaction;
  }

  async getTransactions(
    userId: string,
    shopId: string
  ): Promise<InventoryTransaction[]> {
    console.log('[InventoryService] Getting transactions:', {
      userId,
      shopId,
      timestamp: new Date().toISOString(),
    });

    // Получаем все склады магазина
    const warehouses = await this.warehouseRepository.find({
      where: { shopId, isActive: true },
      order: { isMain: 'DESC', name: 'ASC' },
    });

    if (!warehouses || warehouses.length === 0) {
      console.warn('[InventoryService] No warehouses found for shop:', {
        shopId,
        timestamp: new Date().toISOString(),
      });
      throw new NotFoundException('Склады не найдены для данного магазина');
    }

    console.log('[InventoryService] Found warehouses:', {
      count: warehouses.length,
      warehouseIds: warehouses.map((w) => w.id),
    });

    // Проверяем доступ к складам и получаем ID доступного склада
    let accessibleWarehouseId;
    for (const warehouse of warehouses) {
      try {
        accessibleWarehouseId = await this.validateManagerAccess(
          userId,
          warehouse.id
        );
        break; // Если нашли доступный склад, прекращаем поиск
      } catch (error) {
        console.warn('[InventoryService] No access to warehouse:', {
          warehouseId: warehouse.id,
          error: error.message,
        });
        continue;
      }
    }

    if (!accessibleWarehouseId) {
      console.warn('[InventoryService] No accessible warehouses found:', {
        shopId,
        userId,
        timestamp: new Date().toISOString(),
      });
      throw new ForbiddenException(
        'У вас нет доступа к складам данного магазина'
      );
    }

    console.log('[InventoryService] Using accessible warehouse:', {
      warehouseId: accessibleWarehouseId,
    });

    // Получаем транзакции для доступного склада
    return this.transactionRepository.find({
      where: {
        warehouseId: accessibleWarehouseId,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
      relations: ['warehouseProduct', 'warehouseProduct.barcode', 'createdBy'],
    });
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

  async findAll(warehouseId: string, userId: string) {
    console.log('[InventoryService] findAll called:', {
      warehouseId,
      userId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate manager access
      await this.validateManagerAccess(userId, warehouseId);

      console.log('[InventoryService] Access validated, fetching adjustments');

      // Get all inventory adjustments for this warehouse
      const adjustments = await this.transactionRepository.find({
        where: {
          warehouseId,
          type: EntityTransactionType.ADJUSTMENT,
          isActive: true,
        },
        order: { createdAt: 'DESC' },
        relations: [
          'warehouseProduct',
          'warehouseProduct.barcode',
          'createdBy',
        ],
      });

      console.log('[InventoryService] Found adjustments:', {
        count: adjustments.length,
        warehouseId,
        timestamp: new Date().toISOString(),
        sample: adjustments.slice(0, 2).map((adj) => ({
          id: adj.id,
          type: adj.type,
          metadata: adj.metadata,
          quantity: adj.quantity,
        })),
      });

      return adjustments;
    } catch (error) {
      console.error('[InventoryService] Error in findAll:', {
        error: error.message,
        stack: error.stack,
        warehouseId,
        userId,
      });
      throw error;
    }
  }

  async findOne(id: number, warehouseId: string, userId: string) {
    console.log('[InventoryService] findOne called:', {
      id,
      warehouseId,
      userId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate manager access
      await this.validateManagerAccess(userId, warehouseId);

      console.log('[InventoryService] Access validated, fetching adjustment');

      const adjustment = await this.transactionRepository.findOne({
        where: {
          id: String(id),
          warehouseId,
          type: EntityTransactionType.ADJUSTMENT,
          isActive: true,
        },
        relations: [
          'warehouseProduct',
          'warehouseProduct.barcode',
          'createdBy',
        ],
      });

      console.log('[InventoryService] Found adjustment:', {
        found: !!adjustment,
        id,
        warehouseId,
        timestamp: new Date().toISOString(),
      });

      if (!adjustment) {
        throw new NotFoundException('Инвентаризация не найдена');
      }

      return adjustment;
    } catch (error) {
      console.error('[InventoryService] Error in findOne:', {
        error: error.message,
        stack: error.stack,
        id,
        warehouseId,
        userId,
      });
      throw error;
    }
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
              contactPerson: supplier.contactPerson,
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
