import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationPriority)
  priority: NotificationPriority;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsUUID()
  userId: string;

  @IsUUID()
  shopId: string;
}
