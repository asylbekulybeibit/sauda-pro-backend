import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { CreateInventoryNotificationDto } from '../dto/create-inventory-notification.dto';
import { CreateVehicleNotificationDto } from '../dto/create-vehicle-notification.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles, ShopParam } from '../../auth/decorators';
import { RoleType } from '../../auth/types/role.type';

@Controller('shops/:shopId/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Inventory notifications
  @Get('inventory')
  getInventoryRules(
    @ShopParam('shopId') shopId: string,
    @Query('warehouseId') warehouseId: string
  ) {
    return this.notificationsService.getInventoryRules(shopId, warehouseId);
  }

  @Post('inventory')
  createInventoryRule(
    @ShopParam('shopId') shopId: string,
    @Body() dto: CreateInventoryNotificationDto
  ) {
    return this.notificationsService.createInventoryRule(
      dto.warehouseProductId,
      dto.minQuantity
    );
  }

  @Patch('inventory/:id')
  updateInventoryRule(
    @ShopParam('shopId') shopId: string,
    @Param('id') id: string,
    @Body() updates: Partial<CreateInventoryNotificationDto>
  ) {
    return this.notificationsService.updateInventoryRule(id, updates);
  }

  @Delete('inventory/:id')
  deleteInventoryRule(
    @ShopParam('shopId') shopId: string,
    @Param('id') id: string
  ) {
    return this.notificationsService.deleteInventoryRule(id);
  }

  // Vehicle notifications
  @Get('vehicles')
  getVehicleRules(@ShopParam('shopId') shopId: string) {
    return this.notificationsService.getVehicleRules(shopId);
  }

  @Post('vehicles')
  createVehicleRule(
    @ShopParam('shopId') shopId: string,
    @Body() dto: CreateVehicleNotificationDto
  ) {
    return this.notificationsService.createVehicleRule(shopId, dto);
  }

  @Patch('vehicles/:id')
  updateVehicleRule(
    @ShopParam('shopId') shopId: string,
    @Param('id') ruleId: string,
    @Body() updates: Partial<CreateVehicleNotificationDto>
  ) {
    return this.notificationsService.updateVehicleRule(shopId, ruleId, updates);
  }

  @Delete('vehicles/:id')
  deleteVehicleRule(
    @ShopParam('shopId') shopId: string,
    @Param('id') ruleId: string
  ) {
    return this.notificationsService.deleteVehicleRule(shopId, ruleId);
  }
}
