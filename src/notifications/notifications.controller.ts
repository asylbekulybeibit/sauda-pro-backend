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

  @Get('warehouse/:warehouseId')
  async findAll(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Notification[]> {
    // Проверяем, что пользователь имеет доступ к складу
    if (!req.user.warehouses.includes(warehouseId)) {
      throw new ForbiddenException('No access to this warehouse');
    }
    return this.notificationsService.findAll(warehouseId);
  }

  @Get('warehouse/:warehouseId/unread')
  async getUnreadNotifications(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Notification[]> {
    if (!req.user.warehouses.includes(warehouseId)) {
      throw new ForbiddenException('No access to this warehouse');
    }
    return this.notificationsService.getUnreadNotifications(warehouseId);
  }

  @Post(':id/read')
  async markAsRead(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<void> {
    if (!req.user.warehouses.includes(warehouseId)) {
      throw new ForbiddenException('No access to this warehouse');
    }
    await this.notificationsService.markAsRead(id, warehouseId);
  }

  @Post(':id/archive')
  async archive(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<void> {
    if (!req.user.warehouses.includes(warehouseId)) {
      throw new ForbiddenException('No access to this warehouse');
    }
    await this.notificationsService.archive(id, warehouseId);
  }
}
