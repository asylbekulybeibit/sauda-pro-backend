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
  TransactionType,
} from '../entities/inventory-transaction.entity';
import { Product } from '../entities/product.entity';
import { Shop } from '../entities/shop.entity';
import { UserRole, RoleType } from '../../roles/entities/user-role.entity';
import {
  CreateTransactionDto,
  TransferMetadata,
} from '../dto/inventory/create-transaction.dto';
import { NotificationsService } from '../../notifications/notifications.service';

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
      throw new BadRequestException(
        'User does not have manager access to this shop'
      );
    }
  }

  async createTransaction(
    userId: string,
    createTransactionDto: CreateTransactionDto
  ): Promise<InventoryTransaction> {
    const { shopId, productId, type, quantity, metadata } =
      createTransactionDto;

    await this.validateManagerAccess(userId, shopId);

    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['shop'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // For sales, transfers, and write-offs, check if there's enough stock
    if (
      [
        TransactionType.SALE,
        TransactionType.TRANSFER,
        TransactionType.WRITE_OFF,
      ].includes(type)
    ) {
      if (product.quantity < quantity) {
        throw new BadRequestException(
          'Insufficient stock for this transaction'
        );
      }
    }

    // For transfers, validate target shop and create notifications
    if (type === TransactionType.TRANSFER && metadata) {
      const transferMeta = metadata as TransferMetadata;
      const targetShop = await this.shopRepository.findOne({
        where: { id: transferMeta.targetShopId },
      });

      if (!targetShop) {
        throw new NotFoundException('Target shop not found');
      }

      // Create transfer initiated notification
      await this.notificationsService.createTransferInitiatedNotification(
        shopId,
        transferMeta.transferId,
        product.name,
        quantity,
        targetShop.name
      );

      // Create transfer notification for target shop
      await this.notificationsService.createTransferCompletedNotification(
        transferMeta.targetShopId,
        transferMeta.transferId,
        product.name,
        quantity,
        product.shop.name
      );
    }

    const transaction = await this.transactionRepository.save({
      ...createTransactionDto,
      userId,
    });

    // Update product quantity based on transaction type
    const isIncrease =
      type === TransactionType.ADJUSTMENT && quantity > product.quantity;
    const quantityChange = isIncrease ? quantity - product.quantity : -quantity;

    await this.productRepository.update(productId, {
      quantity: () => `quantity + ${quantityChange}`,
    });

    // Refresh product data
    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId },
    });

    // Check for low stock after transaction
    if (updatedProduct.quantity <= updatedProduct.minQuantity) {
      await this.notificationsService.createLowStockNotification(
        shopId,
        updatedProduct.name,
        updatedProduct.quantity
      );
    }

    return transaction;
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
      .getMany();
  }
}
