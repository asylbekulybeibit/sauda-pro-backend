import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
} from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Product } from '../manager/entities/product.entity';
import { InventoryTransaction } from '../manager/entities/inventory-transaction.entity';
import { Promotion } from '../manager/entities/promotion.entity';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
})
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      status: NotificationStatus.UNREAD,
      isRead: false,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);
    this.server
      ?.to(`shop:${createNotificationDto.shopId}`)
      .emit('notification', savedNotification);
    return savedNotification;
  }

  async notifyLowStock(product: Product): Promise<void> {
    await this.create({
      type: NotificationType.LOW_STOCK,
      title: 'Низкий остаток товара',
      message: `Товар "${product.name}" заканчивается (осталось ${product.quantity} шт.)`,
      priority: NotificationPriority.HIGH,
      metadata: {
        productId: product.id,
        quantity: product.quantity,
      },
      shopId: product.shopId,
    });
  }

  async notifyTransfer(
    transaction: InventoryTransaction,
    type: 'initiated' | 'completed'
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: transaction.productId },
    });

    await this.create({
      type:
        type === 'initiated'
          ? NotificationType.TRANSFER_INITIATED
          : NotificationType.TRANSFER_COMPLETED,
      title:
        type === 'initiated'
          ? 'Начато перемещение товара'
          : 'Завершено перемещение товара',
      message: `${
        type === 'initiated' ? 'Начато' : 'Завершено'
      } перемещение товара "${product.name}" (${transaction.quantity} шт.)`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        productId: product.id,
        quantity: transaction.quantity,
        fromShopId: transaction.shopId,
        toShopId: transaction.metadata?.targetShopId,
      },
      shopId: transaction.shopId,
    });
  }

  async findAll(shopId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { shopId },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string, shopId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, shopId },
      { status: NotificationStatus.READ, isRead: true }
    );
  }

  async archive(id: string, shopId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, shopId },
      { status: NotificationStatus.ARCHIVED }
    );
  }

  async getUnreadNotifications(shopId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: {
        shopId,
        status: NotificationStatus.UNREAD,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createLowStockNotification(
    shopId: string,
    productName: string,
    currentStock: number
  ) {
    return await this.create({
      type: NotificationType.LOW_STOCK,
      title: 'Низкий остаток товара',
      message: `Товар "${productName}" заканчивается (осталось ${currentStock} шт.)`,
      priority: NotificationPriority.HIGH,
      metadata: {
        productId: productName,
        currentQuantity: currentStock,
      },
      shopId,
    });
  }

  async createTransferInitiatedNotification(
    shopId: string,
    transferId: string,
    productName: string,
    quantity: number,
    targetShopName: string
  ) {
    return await this.create({
      type: NotificationType.TRANSFER_INITIATED,
      title: 'Начато перемещение товара',
      message: `Начато перемещение ${quantity} шт. товара "${productName}" в магазин ${targetShopName}`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        transferId,
        productId: productName,
        quantity,
        targetShopId: targetShopName,
      },
      shopId,
    });
  }

  async createTransferCompletedNotification(
    shopId: string,
    transferId: string,
    productName: string,
    quantity: number,
    sourceShopName: string
  ) {
    return await this.create({
      type: NotificationType.TRANSFER_COMPLETED,
      title: 'Завершено перемещение товара',
      message: `Получено ${quantity} шт. товара "${productName}" из магазина ${sourceShopName}`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        transferId,
        productId: productName,
        quantity,
        sourceShopId: sourceShopName,
      },
      shopId,
    });
  }

  async notifyPromotionEnding(promotion: Promotion): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (promotion.endDate.getTime() === tomorrow.getTime()) {
      await this.create({
        type: NotificationType.SYSTEM,
        title: 'Скоро завершится акция',
        message: `Акция "${promotion.name}" завершится завтра`,
        priority: NotificationPriority.MEDIUM,
        metadata: {
          promotionId: promotion.id,
          endDate: promotion.endDate,
        },
        shopId: promotion.shopId,
      });
    }
  }

  async deleteOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.notificationRepository.delete({
      createdAt: LessThan(thirtyDaysAgo),
      status: NotificationStatus.ARCHIVED,
    });
  }
}
