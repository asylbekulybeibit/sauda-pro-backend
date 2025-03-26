import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { WarehouseProductsService } from '../services/warehouse-products.service';

@Controller('manager/warehouse-products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class WarehouseProductsController {
  private readonly logger = new Logger(WarehouseProductsController.name);

  constructor(
    private readonly warehouseProductsService: WarehouseProductsService,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccessToWarehouse(
    userId: string,
    shopId: string
  ): Promise<string> {
    this.logger.debug(
      `[validateManagerAccessToWarehouse] Проверка доступа пользователя ${userId} к магазину ${shopId}`
    );

    // Получаем роль менеджера для конкретного склада
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    this.logger.debug(
      `[validateManagerAccessToWarehouse] Найдена роль: ${JSON.stringify(
        managerRole || 'не найдено'
      )}`
    );

    if (!managerRole) {
      this.logger.error(
        `[validateManagerAccessToWarehouse] Роль менеджера не найдена для userId=${userId}`
      );
      throw new ForbiddenException('У вас нет прав менеджера склада');
    }

    if (!managerRole.warehouse) {
      this.logger.error(
        `[validateManagerAccessToWarehouse] У менеджера нет привязки к складу: userId=${userId}, roleId=${managerRole.id}`
      );
      throw new ForbiddenException('У вас нет прав менеджера склада');
    }

    // Проверяем, принадлежит ли склад менеджера указанному магазину
    this.logger.debug(
      `[validateManagerAccessToWarehouse] Склад менеджера: ${JSON.stringify(
        managerRole.warehouse
      )}`
    );

    if (managerRole.warehouse.shopId !== shopId) {
      this.logger.error(
        `[validateManagerAccessToWarehouse] Склад менеджера (${managerRole.warehouse.id}) не принадлежит магазину ${shopId}, warehouse.shopId=${managerRole.warehouse.shopId}`
      );
      throw new ForbiddenException(
        'У вас нет прав менеджера склада для этого магазина'
      );
    }

    this.logger.log(
      `[validateManagerAccessToWarehouse] Доступ подтвержден для userId=${userId}, warehouseId=${managerRole.warehouse.id}`
    );

    // Возвращаем ID склада менеджера
    return managerRole.warehouse.id;
  }

  @Get('shop/:shopId')
  async getWarehouseProductsByShop(
    @Param('shopId') shopId: string,
    @Request() req,
    @Query('isService') isService?: string
  ) {
    this.logger.log(
      `[getWarehouseProductsByShop] Получение товаров склада для магазина ${shopId}, userId=${req.user.id}`
    );

    try {
      // Получаем роль менеджера для конкретного склада
      this.logger.debug(
        `[getWarehouseProductsByShop] Получение роли менеджера`
      );
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          isActive: true,
        },
        relations: ['warehouse'],
      });

      if (!managerRole || !managerRole.warehouse) {
        this.logger.error(
          `[getWarehouseProductsByShop] Роль менеджера не найдена для userId=${req.user.id}`
        );
        throw new ForbiddenException('У вас нет прав менеджера склада');
      }

      const warehouseId = managerRole.warehouse.id;
      const actualShopId = managerRole.warehouse.shopId;

      this.logger.log(
        `[getWarehouseProductsByShop] Запрошен магазин: ${shopId}, фактический магазин менеджера: ${actualShopId}, склад: ${warehouseId}`
      );

      // Преобразуем строковый параметр isService в boolean, если он предоставлен
      const isServiceBoolean = isService ? isService === 'true' : undefined;
      this.logger.debug(
        `[getWarehouseProductsByShop] Параметр isService=${isService}, преобразован в ${isServiceBoolean}`
      );

      // Используем сервис для получения товаров конкретного склада менеджера
      this.logger.debug(
        `[getWarehouseProductsByShop] Запрос товаров для склада ${warehouseId}`
      );
      const products =
        await this.warehouseProductsService.getWarehouseProductsByWarehouseId(
          warehouseId,
          isServiceBoolean
        );

      this.logger.log(
        `[getWarehouseProductsByShop] Успешно получены товары: ${products.length} шт.`
      );
      return products;
    } catch (error) {
      this.logger.error(
        `[getWarehouseProductsByShop] Ошибка при получении товаров: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
