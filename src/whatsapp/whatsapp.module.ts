import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { UserRole } from '../roles/entities/user-role.entity';
import { User } from '../users/entities/user.entity';
import { NotificationSettings } from '../manager/entities/notification-settings.entity';
import { InventoryNotification } from '../manager/entities/inventory-notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserRole,
      User,
      NotificationSettings,
      InventoryNotification,
    ]),
  ],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
