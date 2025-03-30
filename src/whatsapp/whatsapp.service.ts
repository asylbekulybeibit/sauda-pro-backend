import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSettings } from '../manager/entities/notification-settings.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { User } from '../users/entities/user.entity';
import { RoleType } from '../auth/types/role.type';
import { InventoryNotification } from '../manager/entities/inventory-notification.entity';

interface LowStockNotification {
  productName: string;
  currentQuantity: number;
  minQuantity: number;
  warehouseId: string;
  shopId: string;
  warehouseProductId: string;
}

@Injectable()
export class WhatsappService {
  constructor(
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
    @InjectRepository(InventoryNotification)
    private inventoryNotificationRepository: Repository<InventoryNotification>
  ) {}

  async sendLowStockNotification(data: LowStockNotification) {
    try {
      // Проверяем, активно ли правило уведомлений для этого товара
      const notificationRule =
        await this.inventoryNotificationRepository.findOne({
          where: {
            warehouseProductId: data.warehouseProductId,
            warehouseId: data.warehouseId,
            shopId: data.shopId,
          },
        });

      if (!notificationRule?.isEnabled) {
        console.log(
          `[WhatsappService] Уведомления отключены для товара ${data.productName}`
        );
        return;
      }

      // Проверяем настройки уведомлений
      let settings = await this.notificationSettingsRepository.findOne({
        where: {
          shopId: data.shopId,
          warehouseId: data.warehouseId,
          isEnabled: true,
        },
      });

      // Если настроек нет, создаем их с дефолтным интервалом 24 часа
      if (!settings) {
        settings = await this.notificationSettingsRepository.save({
          shopId: data.shopId,
          warehouseId: data.warehouseId,
          notificationIntervalHours: 24,
          isEnabled: true,
        });
      }

      // Проверяем, прошло ли достаточно времени с последнего уведомления
      const now = new Date();
      if (settings.lastNotificationSent) {
        const hoursSinceLastNotification =
          (now.getTime() - settings.lastNotificationSent.getTime()) /
          (1000 * 60 * 60);

        if (hoursSinceLastNotification < settings.notificationIntervalHours) {
          console.log(
            `[WhatsappService] Слишком рано для нового уведомления. Следующее уведомление через ${
              settings.notificationIntervalHours -
              Math.floor(hoursSinceLastNotification)
            } часов`
          );
          return;
        }
      }

      // Получаем роли менеджеров для данного склада
      const managerRoles = await this.userRoleRepository.find({
        where: {
          shopId: data.shopId,
          warehouseId: data.warehouseId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        relations: ['user'],
      });

      if (!managerRoles || managerRoles.length === 0) {
        console.warn(
          '[WhatsappService] Не найдены активные менеджеры для отправки уведомления'
        );
        return;
      }

      const message =
        `⚠️ Внимание! Низкий остаток товара:\n\n` +
        `📦 ${data.productName}\n` +
        `📊 Текущее количество: ${data.currentQuantity}\n` +
        `⚡ Минимальное количество: ${data.minQuantity}`;

      let notificationSent = false;

      // Отправляем уведомление каждому менеджеру
      for (const role of managerRoles) {
        if (!role.user?.phone) {
          console.warn(
            `[WhatsappService] У менеджера ${role.user?.id} не указан номер телефона`
          );
          continue;
        }

        try {
          // TODO: Интегрировать с реальным WhatsApp API
          console.log(
            `[WhatsappService] Отправка сообщения на номер ${role.user.phone}:`,
            message
          );

          // Здесь будет код отправки через WhatsApp API
          // await whatsappClient.sendMessage(role.user.phone, message);
          notificationSent = true;
        } catch (error) {
          console.error(
            `[WhatsappService] Ошибка при отправке сообщения менеджеру ${role.user.id}:`,
            error
          );
        }
      }

      // Обновляем время последнего уведомления только если хотя бы одно сообщение было отправлено
      if (notificationSent) {
        await this.notificationSettingsRepository.update(settings.id, {
          lastNotificationSent: now,
        });
      }

      return notificationSent;
    } catch (error) {
      console.error(
        '[WhatsappService] Ошибка при отправке уведомления:',
        error
      );
      throw error;
    }
  }

  async updateNotificationInterval(
    shopId: string,
    warehouseId: string,
    intervalHours: number
  ) {
    try {
      let settings = await this.notificationSettingsRepository.findOne({
        where: {
          shopId,
          warehouseId,
        },
      });

      if (!settings) {
        settings = await this.notificationSettingsRepository.save({
          shopId,
          warehouseId,
          notificationIntervalHours: intervalHours,
          isEnabled: true,
        });
      } else {
        await this.notificationSettingsRepository.update(settings.id, {
          notificationIntervalHours: intervalHours,
        });
      }

      return settings;
    } catch (error) {
      console.error(
        '[WhatsappService] Ошибка при обновлении интервала уведомлений:',
        error
      );
      throw error;
    }
  }
}
