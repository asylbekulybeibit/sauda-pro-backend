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

  async createNotification(
    type: NotificationType,
    title: string,
    message: string,
    shopId: string,
    metadata?: Record<string, any>,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ) {
    const notification = this.notificationRepository.create({
      type,
      title,
      message,
      shopId,
      metadata,
      priority,
      status: NotificationStatus.UNREAD,
      isRead: false,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    // Отправляем уведомление через WebSocket
    this.server?.to(`shop:${shopId}`).emit('notification', savedNotification);

    return savedNotification;
  }

  async getUnreadNotifications(shopId: string) {
    return this.notificationRepository.find({
      where: {
        shopId,
        isRead: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markAsRead(id: string, shopId: string) {
    await this.notificationRepository.update(
      { id, shopId },
      {
        isRead: true,
        status: NotificationStatus.READ,
      }
    );
  }

  async createLowStockNotification(
    shopId: string,
    productName: string,
    currentStock: number
  ) {
    return await this.createNotification(
      NotificationType.LOW_STOCK,
      'Низкий остаток товара',
      `Товар "${productName}" заканчивается (осталось ${currentStock} шт.)`,
      shopId,
      { productName, currentStock },
      NotificationPriority.HIGH
    );
  }

  async createTransferInitiatedNotification(
    shopId: string,
    transferId: string,
    productName: string,
    quantity: number,
    targetShopName: string
  ) {
    return await this.createNotification(
      NotificationType.TRANSFER_INITIATED,
      'Начато перемещение товара',
      `Начато перемещение ${quantity} шт. товара "${productName}" в магазин ${targetShopName}`,
      shopId,
      { transferId, productName, quantity, targetShopName }
    );
  }

  async createTransferCompletedNotification(
    shopId: string,
    transferId: string,
    productName: string,
    quantity: number,
    sourceShopName: string
  ) {
    return await this.createNotification(
      NotificationType.TRANSFER_COMPLETED,
      'Завершено перемещение товара',
      `Получено ${quantity} шт. товара "${productName}" из магазина ${sourceShopName}`,
      shopId,
      { transferId, productName, quantity, sourceShopName }
    );
  }

  async create(
    createNotificationDto: CreateNotificationDto
  ): Promise<Notification> {
    const notification = this.notificationRepository.create(
      createNotificationDto
    );
    await this.notificationRepository.save(notification);

    // Отправляем уведомление через WebSocket
    this.server
      .to(`shop:${notification.shopId}`)
      .emit('notification', notification);
    this.server
      .to(`user:${notification.userId}`)
      .emit('notification', notification);

    return notification;
  }

  async findAll(shopId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { shopId },
      order: { createdAt: 'DESC' },
    });
  }

  async checkLowStock(transaction: InventoryTransaction): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: transaction.productId },
    });

    if (
      product &&
      product.minQuantity &&
      product.quantity <= product.minQuantity
    ) {
      await this.create({
        type: NotificationType.LOW_STOCK,
        title: 'Низкий остаток товара',
        message: `Товар "${product.name}" достиг минимального остатка (${product.quantity} шт.)`,
        priority: product.quantity === 0 ? 'urgent' : 'high',
        metadata: {
          productId: product.id,
          currentQuantity: product.quantity,
          minQuantity: product.minQuantity,
        },
        userId: transaction.createdById,
        shopId: product.shopId,
      });
    }
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
      priority: 'medium',
      metadata: {
        productId: product.id,
        quantity: transaction.quantity,
        fromShopId: transaction.shopId,
        toShopId: transaction.metadata?.targetShopId,
      },
      userId: transaction.createdById,
      shopId: transaction.shopId,
    });
  }

  async notifyPromotionEnding(promotion: Promotion): Promise<void> {
    // Уведомляем за день до окончания акции
    const endDate = new Date(promotion.endDate);
    const now = new Date();
    const oneDayBefore = new Date(endDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);

    if (now >= oneDayBefore && now < endDate) {
      await this.create({
        type: NotificationType.PROMOTION_ENDING,
        title: 'Скоро завершится акция',
        message: `Акция "${promotion.name}" завершится завтра`,
        priority: 'medium',
        metadata: {
          promotionId: promotion.id,
          endDate: promotion.endDate,
        },
        userId: promotion.createdById,
        shopId: promotion.shopId,
      });
    }
  }

  async archive(id: string, shopId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, shopId },
      { status: NotificationStatus.ARCHIVED }
    );
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
