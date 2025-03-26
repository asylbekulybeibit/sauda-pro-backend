import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  NotFoundException,
  ForbiddenException,
  Logger,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ManagerService } from '../services/manager.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { Warehouse } from '../entities/warehouse.entity';

@Controller('manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ManagerController {
  private readonly logger = new Logger(ManagerController.name);

  constructor(
    private readonly managerService: ManagerService,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>
  ) {}

  @Get('dashboard')
  async getDashboard(@Request() req) {
    return this.managerService.getDashboard(req.user.id);
  }

  @Get('warehouses/:id')
  async getWarehouse(@Param('id') id: string, @Request() req) {
    return this.managerService.getWarehouse(id, req.user.id);
  }

  @Get('shops/:shopId')
  async getManagerShop(@Param('shopId') shopId: string, @Request() req) {
    try {
      // Получаем доступную для менеджера роль по складу
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          isActive: true,
        },
        relations: ['warehouse', 'warehouse.shop'],
      });

      if (!managerRole || !managerRole.warehouse) {
        this.logger.warn(`Менеджер ${req.user.id} не имеет доступа к складу`);
        throw new ForbiddenException('У вас нет доступа к складу');
      }

      this.logger.debug(
        `Менеджер запрашивает магазин: ${shopId}, имеет доступ к складу: ${managerRole.warehouseId}`
      );

      // Даже если shopId не совпадает, мы все равно отдаем информацию о складе менеджера
      // так как менеджер имеет доступ только к своему складу
      const warehouse = managerRole.warehouse;

      // Возвращаем только информацию о складе без полного доступа к магазину
      return {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name,
          address: warehouse.address,
          phone: warehouse.phone,
          email: warehouse.email,
          shopId: warehouse.shopId,
        },
        // Минимальная информация о связанном магазине для отображения
        shopName: warehouse.shop ? warehouse.shop.name : 'Магазин',
      };
    } catch (error) {
      this.logger.error(`Ошибка при получении магазина: ${error.message}`);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException(
        'Склад не найден или не относится к указанному магазину'
      );
    }
  }

  @Get('warehouses/shop/:shopId')
  async getWarehousesByShop(@Param('shopId') shopId: string, @Request() req) {
    return this.managerService.getWarehousesByShop(shopId, req.user.id);
  }

  @Get('barcodes/shop/:shopId')
  async getBarcodes(
    @Param('shopId') shopId: string,
    @Request() req,
    @Query('isService') isService?: string
  ) {
    // Преобразуем строковый параметр isService в boolean
    const isServiceBool = isService === 'true' || isService === '1';
    return this.managerService.getBarcodes(shopId, req.user.id, isServiceBool);
  }
}
