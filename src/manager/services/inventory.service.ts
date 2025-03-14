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
    const { shopId, productId, type, quantity, price, metadata, comment } =
      createTransactionDto;

    await this.validateManagerAccess(userId, shopId);

    const product = await this.productRepository.findOne({
      where: { id: productId.toString() },
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
        break;
    }

    // Преобразуем тип транзакции из DTO в тип сущности
    const entityType = EntityTransactionType[type];

    // Создаем транзакцию
    const transaction = this.transactionRepository.create({
      shopId: shopId.toString(),
      productId: productId.toString(),
      type: entityType,
      quantity,
      price,
      metadata,
      note: comment,
      createdById: userId,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Обновляем количество товара
    await this.productRepository.update(productId.toString(), {
      quantity: () => `quantity + ${quantityChange}`,
      ...(price && type === DtoTransactionType.PURCHASE
        ? { purchasePrice: price }
        : {}),
    });

    // Проверяем минимальные остатки после операции
    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId.toString() },
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

    return this.transactionRepository.find({
      where: { shopId },
      order: { createdAt: 'DESC' },
      relations: ['product'],
    });
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
}
