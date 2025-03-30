import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryNotification } from '../entities/inventory-notification.entity';
import { VehicleNotification } from '../entities/vehicle-notification.entity';
import { CreateInventoryNotificationDto } from '../dto/create-inventory-notification.dto';
import { CreateVehicleNotificationDto } from '../dto/create-vehicle-notification.dto';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { WarehouseProductsService } from './warehouse-products.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(InventoryNotification)
    private inventoryNotificationRepo: Repository<InventoryNotification>,
    @InjectRepository(VehicleNotification)
    private vehicleNotificationRepo: Repository<VehicleNotification>,
    @InjectRepository(WarehouseProduct)
    private warehouseProductRepo: Repository<WarehouseProduct>,
    private warehouseProductsService: WarehouseProductsService,
    private whatsappService: WhatsappService
  ) {
    // Запускаем проверку каждые 5 минут
    setInterval(() => this.checkAndNotify(), 5 * 60 * 1000);
  }

  // Inventory notifications
  async getInventoryRules(shopId: string, warehouseId: string) {
    return this.inventoryNotificationRepo.find({
      where: { shopId, warehouseId },
      relations: ['warehouseProduct', 'warehouse'],
    });
  }

  async createInventoryRule(warehouseProductId: string, minQuantity: number) {
    const warehouseProduct =
      await this.warehouseProductsService.findOne(warehouseProductId);
    if (!warehouseProduct) {
      throw new Error('Товар не найден');
    }

    // Обновляем minQuantity в таблице warehouse_products
    await this.warehouseProductsService.update(warehouseProductId, {
      minQuantity,
    });

    const rule = this.inventoryNotificationRepo.create({
      warehouseProductId,
      warehouseId: warehouseProduct.warehouseId,
      minQuantity,
      notifyVia: ['whatsapp'],
      isEnabled: true,
      shopId: warehouseProduct.warehouse.shopId,
    });

    return this.inventoryNotificationRepo.save(rule);
  }

  async updateInventoryRule(
    id: string,
    updates: Partial<InventoryNotification>
  ) {
    const rule = await this.inventoryNotificationRepo.findOne({
      where: { id },
    });
    if (!rule) {
      throw new Error('Правило не найдено');
    }

    // Обновляем minQuantity в таблице warehouse_products если оно изменилось
    if (updates.minQuantity && updates.minQuantity !== rule.minQuantity) {
      await this.warehouseProductsService.update(rule.warehouseProduct.id, {
        minQuantity: updates.minQuantity,
      });
    }

    const updatedRule = {
      ...rule,
      ...updates,
      notifyVia: ['whatsapp'], // Всегда используем WhatsApp
    };

    return this.inventoryNotificationRepo.save(updatedRule);
  }

  async deleteInventoryRule(shopId: string, id: string) {
    const rule = await this.inventoryNotificationRepo.findOne({
      where: { id, shopId },
      relations: ['warehouseProduct'],
    });

    if (!rule) {
      throw new NotFoundException('Правило уведомления не найдено');
    }

    try {
      // Сбрасываем minQuantity в таблице warehouse_products если есть связь
      if (rule.warehouseProduct) {
        await this.warehouseProductsService.update(rule.warehouseProduct.id, {
          minQuantity: 0,
        });
      }

      await this.inventoryNotificationRepo.remove(rule);
      return { success: true };
    } catch (error) {
      console.error('[NotificationsService] Error deleting rule:', error);
      throw new InternalServerErrorException(
        'Ошибка при удалении правила уведомления'
      );
    }
  }

  // Vehicle notifications
  async getVehicleRules(shopId: string) {
    return this.vehicleNotificationRepo.find({
      where: { shopId },
    });
  }

  async createVehicleRule(shopId: string, dto: CreateVehicleNotificationDto) {
    const rule = this.vehicleNotificationRepo.create({
      ...dto,
      shopId,
    });
    return this.vehicleNotificationRepo.save(rule);
  }

  async updateVehicleRule(
    shopId: string,
    ruleId: string,
    updates: Partial<CreateVehicleNotificationDto>
  ) {
    const rule = await this.vehicleNotificationRepo.findOne({
      where: { id: ruleId, shopId },
    });

    if (!rule) {
      throw new NotFoundException('Notification rule not found');
    }

    Object.assign(rule, updates);
    return this.vehicleNotificationRepo.save(rule);
  }

  async deleteVehicleRule(shopId: string, ruleId: string) {
    const rule = await this.vehicleNotificationRepo.findOne({
      where: { id: ruleId, shopId },
    });

    if (!rule) {
      throw new NotFoundException('Notification rule not found');
    }

    await this.vehicleNotificationRepo.remove(rule);
  }

  async checkAndNotify() {
    try {
      const notifications = await this.inventoryNotificationRepo.find({
        where: {
          isEnabled: true,
        },
        relations: [
          'warehouseProduct',
          'warehouseProduct.barcode',
          'warehouseProduct.warehouse',
        ],
      });

      for (const notification of notifications) {
        const { warehouseProduct } = notification;
        if (!warehouseProduct) continue;

        const currentQuantity = warehouseProduct.quantity;
        const minQuantity = notification.minQuantity;

        if (currentQuantity <= minQuantity) {
          await this.whatsappService.sendLowStockNotification({
            productName: warehouseProduct.barcode.productName,
            currentQuantity,
            minQuantity,
            warehouseId: warehouseProduct.warehouseId,
            shopId: notification.shopId,
            warehouseProductId: warehouseProduct.id,
          });
        }
      }
    } catch (error) {
      console.error(
        '[NotificationsService] Error checking notifications:',
        error
      );
    }
  }
}
