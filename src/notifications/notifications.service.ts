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

    // Эмитим событие в комнату склада
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
      warehouseId: warehouseProduct.warehouseId,
    });
  }

  async notifyTransfer(
    transaction: InventoryTransaction,
    type: 'initiated' | 'completed'
  ): Promise<void> {
    const warehouseProduct = await this.warehouseProductRepository.findOne({
      where: { id: transaction.warehouseProductId },
      relations: ['barcode', 'barcode.category', 'warehouse'],
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
      warehouseId: transaction.warehouseId,
    });
  }

  async findAll(warehouseId: string): Promise<Notification[]> {
    const whereCondition: any = { warehouseId };

    return this.notificationRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string, warehouseId: string): Promise<void> {
    const whereCondition: any = { id, warehouseId };

    await this.notificationRepository.update(whereCondition, {
      status: NotificationStatus.READ,
    });
  }

  async archive(id: string, warehouseId: string): Promise<void> {
    const whereCondition: any = { id, warehouseId };

    // Архивацию пока заменим на отметку как прочитанное
    await this.notificationRepository.update(whereCondition, {
      status: NotificationStatus.READ,
    });
  }

  async getUnreadNotifications(warehouseId: string): Promise<Notification[]> {
    const whereCondition: any = {
      warehouseId,
      status: NotificationStatus.UNREAD,
    };

    return this.notificationRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async createLowStockNotification(
    warehouseId: string,
    productName: string,
    currentStock: number
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
      warehouseId,
    });
  }

  async createTransferInitiatedNotification(
    warehouseId: string,
    transferId: string,
    productName: string,
    quantity: number,
    targetWarehouseName: string,
    targetWarehouseId?: string
  ) {
    return await this.create({
      type: NotificationType.SYSTEM,
      title: 'Начато перемещение товара',
      message: `Начато перемещение ${quantity} шт. товара "${productName}" в склад ${targetWarehouseName}`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        transferId,
        productId: productName,
        quantity,
        targetWarehouseName,
        targetWarehouseId,
      },
      warehouseId,
    });
  }

  async createTransferCompletedNotification(
    warehouseId: string,
    transferId: string,
    productName: string,
    quantity: number,
    sourceWarehouseName: string,
    sourceWarehouseId?: string
  ) {
    return await this.create({
      type: NotificationType.SYSTEM,
      title: 'Завершено перемещение товара',
      message: `Получено ${quantity} шт. товара "${productName}" из склада ${sourceWarehouseName}`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        transferId,
        productId: productName,
        quantity,
        sourceWarehouseName,
        sourceWarehouseId,
      },
      warehouseId,
    });
  }

  async notifyPromotionEnding(promotion: Promotion): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (promotion.endDate >= tomorrow) return;

    await this.create({
      type: NotificationType.SYSTEM,
      title: 'Акция заканчивается',
      message: `Акция "${promotion.name}" закончится завтра`,
      priority: NotificationPriority.MEDIUM,
      metadata: {
        promotionId: promotion.id,
        promotionName: promotion.name,
        endDate: promotion.endDate,
      },
      warehouseId: promotion.warehouseId,
    });
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
