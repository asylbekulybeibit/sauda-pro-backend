import { Injectable, NotFoundException } from '@nestjs/common';
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

  async deleteInventoryRule(id: string) {
    const rule = await this.inventoryNotificationRepo.findOne({
      where: { id },
    });
    if (!rule) {
      throw new Error('Правило не найдено');
    }

    // Сбрасываем minQuantity в таблице warehouse_products
    await this.warehouseProductsService.update(rule.warehouseProduct.id, {
      minQuantity: 0,
    });

    await this.inventoryNotificationRepo.remove(rule);
    return true;
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

  private async checkAndNotify() {
    try {
      console.log(
        '[NotificationsService] Начинаем проверку товаров с низким количеством...'
      );

      // Получаем все активные правила с их товарами
      const rules = await this.inventoryNotificationRepo.find({
        where: { isEnabled: true },
        relations: ['warehouseProduct', 'warehouseProduct.barcode'],
      });

      for (const rule of rules) {
        const product = rule.warehouseProduct;

        // Проверяем только активные товары (не услуги)
        if (!product.isActive || product.barcode.isService) {
          continue;
        }

        // Проверяем количество
        if (product.quantity <= rule.minQuantity) {
          console.log(
            `[NotificationsService] Товар ${product.barcode.productName} имеет низкое количество (${product.quantity}/${rule.minQuantity})`
          );

          // Отправляем уведомление через WhatsApp
          await this.whatsappService.sendLowStockNotification({
            productName: product.barcode.productName,
            currentQuantity: product.quantity,
            minQuantity: rule.minQuantity,
          });
        }
      }
    } catch (error) {
      console.error(
        '[NotificationsService] Ошибка при проверке товаров:',
        error
      );
    }
  }
}
