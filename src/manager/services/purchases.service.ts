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
import { PurchaseItem } from '../entities/purchase-item.entity';

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
    @InjectRepository(PurchaseItem)
    private purchaseItemRepository: Repository<PurchaseItem>,
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

    let purchase: Purchase;

    // Если это черновик и у нас есть id, пытаемся найти существующий черновик
    if (
      createPurchaseDto.status === PurchaseStatus.DRAFT &&
      createPurchaseDto.id
    ) {
      const existingDraft = await this.purchaseRepository.findOne({
        where: {
          id: createPurchaseDto.id,
          shopId: createPurchaseDto.shopId,
          status: PurchaseStatus.DRAFT,
          isActive: true,
        },
      });

      if (existingDraft) {
        // Обновляем существующий черновик
        purchase = existingDraft;
        purchase.supplierId = createPurchaseDto.supplierId;
        purchase.invoiceNumber = createPurchaseDto.invoiceNumber;
        purchase.date = createPurchaseDto.date;
        purchase.comment = createPurchaseDto.comment;
      } else {
        // Создаем новый черновик
        purchase = new Purchase();
        purchase.shopId = createPurchaseDto.shopId;
        purchase.supplierId = createPurchaseDto.supplierId;
        purchase.invoiceNumber = createPurchaseDto.invoiceNumber;
        purchase.date = createPurchaseDto.date;
        purchase.comment = createPurchaseDto.comment;
        purchase.createdById = userId;
        purchase.status = PurchaseStatus.DRAFT;
      }
    } else {
      // Создаем новую запись для завершенного прихода
      purchase = new Purchase();
      purchase.shopId = createPurchaseDto.shopId;
      purchase.supplierId = createPurchaseDto.supplierId;
      purchase.invoiceNumber = createPurchaseDto.invoiceNumber;
      purchase.date = createPurchaseDto.date;
      purchase.comment = createPurchaseDto.comment;
      purchase.createdById = userId;
      purchase.status = createPurchaseDto.status || PurchaseStatus.COMPLETED;
    }

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

    // For drafts, save or update items in purchase_items table
    if (savedPurchase.status === PurchaseStatus.DRAFT) {
      console.log('Saving/updating items for draft purchase');

      // Если это существующий черновик, получаем текущие items
      if (createPurchaseDto.id) {
        const currentItems = await this.purchaseItemRepository.find({
          where: { purchaseId: savedPurchase.id },
        });

        // Создаем Map для быстрого поиска по productId
        const currentItemsMap = new Map(
          currentItems.map((item) => [item.productId, item])
        );

        // Создаем Set с productId из новых данных для быстрой проверки
        const updatedProductIds = new Set(
          createPurchaseDto.items.map((item) => item.productId)
        );

        // Удаляем items которых больше нет в списке
        const itemsToDelete = currentItems.filter(
          (item) => !updatedProductIds.has(item.productId)
        );
        if (itemsToDelete.length > 0) {
          await this.purchaseItemRepository.remove(itemsToDelete);
        }

        // Обновляем существующие и создаем новые items
        for (const item of createPurchaseDto.items) {
          const existingItem = currentItemsMap.get(item.productId);

          if (existingItem) {
            // Обновляем существующий item
            existingItem.quantity = item.quantity;
            existingItem.price = item.price;
            existingItem.serialNumber = item.serialNumber;
            existingItem.expiryDate = item.expiryDate;
            existingItem.comment = item.comment;
            await this.purchaseItemRepository.save(existingItem);
          } else {
            // Создаем новый item
            const purchaseItem = new PurchaseItem();
            purchaseItem.purchaseId = savedPurchase.id;
            purchaseItem.productId = item.productId;
            purchaseItem.quantity = item.quantity;
            purchaseItem.price = item.price;
            purchaseItem.serialNumber = item.serialNumber;
            purchaseItem.expiryDate = item.expiryDate;
            purchaseItem.comment = item.comment;
            await this.purchaseItemRepository.save(purchaseItem);
          }
        }
      } else {
        // Для нового черновика просто создаем items
        for (const item of createPurchaseDto.items) {
          const purchaseItem = new PurchaseItem();
          purchaseItem.purchaseId = savedPurchase.id;
          purchaseItem.productId = item.productId;
          purchaseItem.quantity = item.quantity;
          purchaseItem.price = item.price;
          purchaseItem.serialNumber = item.serialNumber;
          purchaseItem.expiryDate = item.expiryDate;
          purchaseItem.comment = item.comment;
          await this.purchaseItemRepository.save(purchaseItem);
        }
      }
    }
    // For completed purchases, create inventory transactions
    else {
      console.log('Creating inventory transactions for COMPLETED purchase');
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

    // Get all purchases with related data
    const purchases = await this.purchaseRepository.find({
      where: { shopId, isActive: true },
      relations: [
        'supplier',
        'transactions',
        'transactions.product',
        'createdBy',
        'items',
        'items.product',
      ],
      order: { date: 'DESC' },
    });

    // Transform data for frontend
    return purchases.map((purchase) => {
      let items;
      if (purchase.status === PurchaseStatus.DRAFT) {
        // For drafts, use items from purchase_items table
        items =
          purchase.items?.map((item) => ({
            productId: item.productId,
            product: {
              name: item.product.name,
              sku: item.product.sku,
            },
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
            serialNumber: item.serialNumber,
            expiryDate: item.expiryDate,
            comment: item.comment,
          })) || [];
      } else {
        // For completed purchases, use transactions
        items =
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
      }

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

    // For drafts, we need to get items from purchase_items table
    if (purchase.status === PurchaseStatus.DRAFT) {
      const purchaseItems = await this.purchaseItemRepository.find({
        where: { purchaseId: id },
        relations: ['product'],
      });

      const items = purchaseItems.map((item) => ({
        productId: item.productId,
        product: {
          name: item.product.name,
          sku: item.product.sku,
        },
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
        serialNumber: item.serialNumber,
        expiryDate: item.expiryDate,
        comment: item.comment,
      }));

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

    // For completed purchases, use transactions as before
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

  // Добавляем новый метод для обновления статуса прихода
  async updatePurchaseStatus(
    userId: string,
    id: string,
    shopId: string,
    status: PurchaseStatus
  ): Promise<PurchaseWithItems> {
    await this.validateManagerAccess(userId, shopId);

    // Находим существующий черновик
    const purchase = await this.purchaseRepository.findOne({
      where: { id, shopId, isActive: true },
      relations: ['items', 'items.product'],
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    // Проверяем, меняется ли статус с DRAFT на COMPLETED
    const isCompletingDraft =
      purchase.status === PurchaseStatus.DRAFT &&
      status === PurchaseStatus.COMPLETED;

    if (isCompletingDraft) {
      console.log('Completing draft purchase, creating inventory transactions');

      // Get items from purchase_items table
      const purchaseItems = await this.purchaseItemRepository.find({
        where: { purchaseId: id },
        relations: ['product'],
      });

      // Обновляем totalAmount и totalItems
      let totalAmount = 0;
      let totalItems = 0;
      for (const item of purchaseItems) {
        totalAmount += item.price * item.quantity;
        totalItems += item.quantity;
      }
      purchase.totalAmount = totalAmount;
      purchase.totalItems = totalItems;

      // Create transactions for each item
      for (const item of purchaseItems) {
        const purchaseItemDto = {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          serialNumber: item.serialNumber,
          expiryDate: item.expiryDate,
          comment: item.comment,
        };

        await this.createPurchaseTransaction(
          userId,
          purchase,
          purchaseItemDto,
          {
            shopId,
            supplierId: purchase.supplierId,
            invoiceNumber: purchase.invoiceNumber,
            date: purchase.date,
            items: [purchaseItemDto],
          } as CreatePurchaseDto
        );
      }

      // Не удаляем purchase_items, они останутся для истории
    }

    // Обновляем статус существующей записи
    purchase.status = status;
    await this.purchaseRepository.save(purchase);

    return this.findOne(id, shopId);
  }

  async updateDraft(
    userId: string,
    id: string,
    updatePurchaseDto: UpdatePurchaseDto
  ): Promise<PurchaseWithItems> {
    console.log('Updating draft purchase:', { id, updatePurchaseDto });
    await this.validateManagerAccess(userId, updatePurchaseDto.shopId);

    // Находим существующий черновик
    const existingPurchase = await this.purchaseRepository.findOne({
      where: { id, isActive: true },
      relations: ['items'],
    });

    if (!existingPurchase) {
      throw new NotFoundException('Purchase draft not found');
    }

    if (existingPurchase.status !== PurchaseStatus.DRAFT) {
      throw new ForbiddenException('Only draft purchases can be updated');
    }

    // Обновляем только те поля, которые предоставлены
    if (updatePurchaseDto.supplierId) {
      existingPurchase.supplierId = updatePurchaseDto.supplierId;
    }
    if (updatePurchaseDto.invoiceNumber) {
      existingPurchase.invoiceNumber = updatePurchaseDto.invoiceNumber;
    }
    if (updatePurchaseDto.date) {
      existingPurchase.date = updatePurchaseDto.date;
    }
    if (updatePurchaseDto.comment !== undefined) {
      existingPurchase.comment = updatePurchaseDto.comment;
    }

    // Обновляем items только если они предоставлены
    if (updatePurchaseDto.items) {
      // Получаем текущие items
      const currentItems = await this.purchaseItemRepository.find({
        where: { purchaseId: id },
      });

      // Создаем Map для быстрого поиска по productId
      const currentItemsMap = new Map(
        currentItems.map((item) => [item.productId, item])
      );

      // Создаем Set с productId из новых данных для быстрой проверки
      const updatedProductIds = new Set(
        updatePurchaseDto.items.map((item) => item.productId)
      );

      // Удаляем items которых больше нет в списке
      const itemsToDelete = currentItems.filter(
        (item) => !updatedProductIds.has(item.productId)
      );
      if (itemsToDelete.length > 0) {
        await this.purchaseItemRepository.remove(itemsToDelete);
      }

      // Обновляем существующие и создаем новые items
      for (const item of updatePurchaseDto.items) {
        const existingItem = currentItemsMap.get(item.productId);

        if (existingItem) {
          // Обновляем только предоставленные поля
          if (item.quantity !== undefined) {
            existingItem.quantity = item.quantity;
          }
          if (item.price !== undefined) {
            existingItem.price = item.price;
          }
          if (item.serialNumber !== undefined) {
            existingItem.serialNumber = item.serialNumber;
          }
          if (item.expiryDate !== undefined) {
            existingItem.expiryDate = item.expiryDate;
          }
          if (item.comment !== undefined) {
            existingItem.comment = item.comment;
          }
          await this.purchaseItemRepository.save(existingItem);
        } else {
          // Создаем новый item только с предоставленными полями
          const purchaseItem = new PurchaseItem();
          purchaseItem.purchaseId = existingPurchase.id;
          purchaseItem.productId = item.productId;
          purchaseItem.quantity = item.quantity || 0;
          purchaseItem.price = item.price || 0;
          if (item.serialNumber !== undefined) {
            purchaseItem.serialNumber = item.serialNumber;
          }
          if (item.expiryDate !== undefined) {
            purchaseItem.expiryDate = item.expiryDate;
          }
          if (item.comment !== undefined) {
            purchaseItem.comment = item.comment;
          }
          await this.purchaseItemRepository.save(purchaseItem);
        }
      }

      // Пересчитываем общую сумму и количество товаров
      const updatedItems = await this.purchaseItemRepository.find({
        where: { purchaseId: id },
      });
      let totalAmount = 0;
      let totalItems = 0;
      for (const item of updatedItems) {
        totalAmount += item.price * item.quantity;
        totalItems += item.quantity;
      }
      existingPurchase.totalAmount = totalAmount;
      existingPurchase.totalItems = totalItems;
    }

    // Сохраняем обновленный приход
    const savedPurchase = await this.purchaseRepository.save(existingPurchase);

    return this.findOne(
      savedPurchase.id,
      updatePurchaseDto.shopId || existingPurchase.shopId
    );
  }
}
