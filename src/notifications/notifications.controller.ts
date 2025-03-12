import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('shop/:shopId')
  async findAll(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Notification[]> {
    // Проверяем, что пользователь имеет доступ к магазину
    if (!req.user.shops.includes(shopId)) {
      throw new ForbiddenException('No access to this shop');
    }
    return this.notificationsService.findAll(shopId);
  }

  @Get('shop/:shopId/unread')
  async getUnreadNotifications(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Notification[]> {
    if (!req.user.shops.includes(shopId)) {
      throw new ForbiddenException('No access to this shop');
    }
    return this.notificationsService.getUnreadNotifications(shopId);
  }

  @Post(':id/read')
  async markAsRead(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<void> {
    if (!req.user.shops.includes(shopId)) {
      throw new ForbiddenException('No access to this shop');
    }
    await this.notificationsService.markAsRead(id, shopId);
  }

  @Post(':id/archive')
  async archive(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<void> {
    if (!req.user.shops.includes(shopId)) {
      throw new ForbiddenException('No access to this shop');
    }
    await this.notificationsService.archive(id, shopId);
  }
}
