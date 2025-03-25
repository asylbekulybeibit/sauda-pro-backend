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
import { InventoryTransaction } from '../manager/entities/inventory-transaction.entity';
import { Promotion } from '../manager/entities/promotion.entity';
import { WarehouseProduct } from '../manager/entities/warehouse-product.entity';

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
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      status: NotificationStatus.UNREAD,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    // Эмитим событие в комнату магазина
    this.server
      ?.to(`shop:${createNotificationDto.shopId}`)
      .emit('notification', savedNotification);

    // Если указан склад, эмитим событие ещё и в комнату склада
    if (createNotificationDto.warehouseId) {
      this.server
        ?.to(`warehouse:${createNotificationDto.warehouseId}`)
        .emit('notification', savedNotification);
    }

    return savedNotification;
  }

  async notifyLowStock(warehouseProduct: WarehouseProduct): Promise<void> {
    await this.create({
      type: NotificationType.SYSTEM,
      title: 'Низкий остаток товара',
      message: `Товар заканчивается (осталось ${warehouseProduct.quantity} шт.)`,
      priority: NotificationPriority.HIGH,
      metadata: {
        warehouseProductId: warehouseProduct.id,
        quantity: warehouseProduct.quantity,
      },
      shopId: warehouseProduct.warehouse.shopId,
      warehouseId: warehouseProduct.warehouseId,
    });
  }

  async notifyTransfer(
    transaction: InventoryTransaction,
    type: 'initiated' | 'completed'
  ): Promise<void> {
    const warehouseProduct = await this.warehouseProductRepository.findOne({
      where: { id: transaction.warehouseProductId },
      relations: ['barcode', 'warehouse'],
    });

    if (!warehouseProduct) return;

    await this.create({
      type: NotificationType.SYSTEM,
      title:
        type === 'initiated'
          ? 'Начато перемещение товара'
          : 'Завершено перемещение товара',
      message: `${
        type === 'initiated' ? 'Начато' : 'Завершено'
      } перемещение товара "${warehouseProduct.barcode.productName}" (${
        transaction.quantity
      } шт.)`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        warehouseProductId: warehouseProduct.id,
        quantity: transaction.quantity,
        fromWarehouseId: transaction.warehouseId,
        toWarehouseId: transaction.metadata?.targetWarehouseId,
      },
      shopId: warehouseProduct.warehouse.shopId,
      warehouseId: transaction.warehouseId,
    });
  }

  async findAll(shopId: string, warehouseId?: string): Promise<Notification[]> {
    const whereCondition: any = { shopId };

    if (warehouseId) {
      whereCondition.warehouseId = warehouseId;
    }

    return this.notificationRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(
    id: string,
    shopId: string,
    warehouseId?: string
  ): Promise<void> {
    const whereCondition: any = { id, shopId };

    if (warehouseId) {
      whereCondition.warehouseId = warehouseId;
    }

    await this.notificationRepository.update(whereCondition, {
      status: NotificationStatus.READ,
    });
  }

  async archive(
    id: string,
    shopId: string,
    warehouseId?: string
  ): Promise<void> {
    const whereCondition: any = { id, shopId };

    if (warehouseId) {
      whereCondition.warehouseId = warehouseId;
    }

    // Архивацию пока заменим на отметку как прочитанное
    await this.notificationRepository.update(whereCondition, {
      status: NotificationStatus.READ,
    });
  }

  async getUnreadNotifications(
    shopId: string,
    warehouseId?: string
  ): Promise<Notification[]> {
    const whereCondition: any = {
      shopId,
      status: NotificationStatus.UNREAD,
    };

    if (warehouseId) {
      whereCondition.warehouseId = warehouseId;
    }

    return this.notificationRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async createLowStockNotification(
    shopId: string,
    productName: string,
    currentStock: number,
    warehouseId?: string
  ) {
    return await this.create({
      type: NotificationType.SYSTEM,
      title: 'Низкий остаток товара',
      message: `Товар "${productName}" заканчивается (осталось ${currentStock} шт.)`,
      priority: NotificationPriority.HIGH,
      metadata: {
        productId: productName,
        currentQuantity: currentStock,
      },
      shopId,
      warehouseId,
    });
  }

  async createTransferInitiatedNotification(
    shopId: string,
    transferId: string,
    productName: string,
    quantity: number,
    targetShopName: string,
    warehouseId?: string,
    targetWarehouseId?: string
  ) {
    return await this.create({
      type: NotificationType.SYSTEM,
      title: 'Начато перемещение товара',
      message: `Начато перемещение ${quantity} шт. товара "${productName}" в магазин ${targetShopName}`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        transferId,
        productId: productName,
        quantity,
        targetShopId: targetShopName,
        targetWarehouseId,
      },
      shopId,
      warehouseId,
    });
  }

  async createTransferCompletedNotification(
    shopId: string,
    transferId: string,
    productName: string,
    quantity: number,
    sourceShopName: string,
    warehouseId?: string,
    sourceWarehouseId?: string
  ) {
    return await this.create({
      type: NotificationType.SYSTEM,
      title: 'Завершено перемещение товара',
      message: `Получено ${quantity} шт. товара "${productName}" из магазина ${sourceShopName}`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        transferId,
        productId: productName,
        quantity,
        sourceShopId: sourceShopName,
        sourceWarehouseId,
      },
      shopId,
      warehouseId,
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
        warehouseId: promotion.warehouseId,
      });
    }
  }

  async deleteOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.notificationRepository.delete({
      createdAt: LessThan(thirtyDaysAgo),
      status: NotificationStatus.READ, // Удаляем только прочитанные уведомления
    });
  }
}
