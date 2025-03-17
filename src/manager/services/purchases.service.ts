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

  async createPurchase(
    userId: string,
    createPurchaseDto: CreatePurchaseDto
  ): Promise<PurchaseWithItems> {
    console.log('Creating purchase with data:', createPurchaseDto);
    await this.validateManagerAccess(userId, createPurchaseDto.shopId);

    // Проверяем существование поставщика
    const supplier = await this.supplierRepository.findOne({
      where: { id: createPurchaseDto.supplierId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Создаем запись прихода
    const purchase = new Purchase();
    purchase.shopId = createPurchaseDto.shopId;
    purchase.supplierId = createPurchaseDto.supplierId;
    purchase.invoiceNumber = createPurchaseDto.invoiceNumber;
    purchase.date = createPurchaseDto.date;
    purchase.comment = createPurchaseDto.comment;
    purchase.createdById = userId;
    purchase.status = createPurchaseDto.status || PurchaseStatus.COMPLETED;

    // Вычисляем общую сумму и общее количество товаров
    let totalAmount = 0;
    let totalItems = 0;
    for (const item of createPurchaseDto.items) {
      totalAmount += item.price * item.quantity;
      totalItems += item.quantity;
    }
    purchase.totalAmount = totalAmount;
    purchase.totalItems = totalItems;

    // Сохраняем приход
    const savedPurchase = await this.purchaseRepository.save(purchase);
    console.log('Saved purchase:', savedPurchase);

    // Создаем транзакции для каждого товара
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

    return this.findOne(savedPurchase.id, createPurchaseDto.shopId);
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

    // Создаем транзакцию
    const transaction = new InventoryTransaction();
    transaction.shopId = purchase.shopId;
    transaction.productId = item.productId;
    transaction.type = TransactionType.PURCHASE;
    transaction.quantity = item.quantity;
    transaction.price = item.price;
    transaction.note = item.comment;
    transaction.createdById = userId;
    transaction.purchaseId = purchase.id;
    transaction.metadata = {
      supplierId: purchase.supplierId,
      invoiceNumber: purchase.invoiceNumber,
      serialNumber: item.serialNumber,
      expiryDate: item.expiryDate,
    };

    return this.transactionRepository.save(transaction);
  }

  private async updateProductPrices(
    createPurchaseDto: CreatePurchaseDto
  ): Promise<void> {
    for (const item of createPurchaseDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, isActive: true },
      });

      if (product) {
        // Обновляем закупочную цену, если нужно
        if (createPurchaseDto.updatePurchasePrices) {
          product.purchasePrice = item.price;
        }

        // Обновляем цену продажи, если нужно
        if (createPurchaseDto.updatePrices) {
          // Здесь можно добавить логику расчета цены продажи на основе закупочной
          // Например, добавить наценку
          const markup = 1.3; // 30% наценка
          product.sellingPrice = item.price * markup;
        }

        await this.productRepository.save(product);
      }
    }
  }

  async findAll(userId: string, shopId: string): Promise<PurchaseWithItems[]> {
    await this.validateManagerAccess(userId, shopId);

    // Получаем все приходы с загрузкой связанных транзакций и товаров
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

    // Преобразуем данные для фронтенда, добавляя массив items для каждого прихода
    return purchases.map((purchase) => {
      // Если у прихода есть транзакции, преобразуем их в массив items
      const items =
        purchase.transactions?.map((transaction) => ({
          productId: transaction.productId,
          product: {
            name: transaction.product.name,
            sku: transaction.product.sku,
          },
          quantity: transaction.quantity,
          price: transaction.price,
          total: transaction.quantity * transaction.price,
          serialNumber: transaction.metadata?.serialNumber,
          expiryDate: transaction.metadata?.expiryDate,
          comment: transaction.note,
        })) || [];

      // Возвращаем приход с добавленным массивом items
      return {
        ...purchase,
        items,
        createdBy: purchase.createdBy
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
          : undefined,
      } as PurchaseWithItems;
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

    // Преобразуем данные для фронтенда
    const items = purchase.transactions.map((transaction) => ({
      productId: transaction.productId,
      product: {
        name: transaction.product.name,
        sku: transaction.product.sku,
      },
      quantity: transaction.quantity,
      price: transaction.price,
      total: transaction.quantity * transaction.price,
      serialNumber: transaction.metadata?.serialNumber,
      expiryDate: transaction.metadata?.expiryDate,
      comment: transaction.note,
    }));

    // Используем расширенный интерфейс для возвращаемого объекта
    return {
      ...purchase,
      items,
      createdBy: purchase.createdBy
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
        : undefined,
    } as PurchaseWithItems;
  }

  async deletePurchase(
    userId: string,
    id: string,
    shopId: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, shopId);

    const purchase = await this.findOne(id, shopId);

    // Мягкое удаление прихода
    purchase.isActive = false;
    await this.purchaseRepository.save(purchase);

    // Мягкое удаление связанных транзакций
    const transactions = await this.transactionRepository.find({
      where: { purchaseId: id },
    });

    for (const transaction of transactions) {
      transaction.isActive = false;
      await this.transactionRepository.save(transaction);
    }
  }
}
