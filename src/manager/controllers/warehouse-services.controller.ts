import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
  Logger,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { WarehouseServicesService } from '../services/warehouse-services.service';
import { CreateWarehouseServiceDto } from '../dto/warehouse-service/create-warehouse-service.dto';
// import { UpdateWarehouseServiceDto } from '../dto/warehouse-service/update-warehouse-service.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';

@Controller('manager/warehouse-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class WarehouseServicesController {
  private readonly logger = new Logger(WarehouseServicesController.name);

  constructor(
    private readonly warehouseServicesService: WarehouseServicesService,
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
    this.logger.debug(
      `[validateManagerAccessToWarehouse] Поиск роли менеджера в БД`
    );
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    this.logger.debug(
      `[validateManagerAccessToWarehouse] Результат запроса роли: ${JSON.stringify(
        managerRole || 'роль не найдена'
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
      `[validateManagerAccessToWarehouse] Проверка соответствия склада (${managerRole.warehouse.id}) и магазина (${shopId})`
    );
    this.logger.debug(
      `[validateManagerAccessToWarehouse] Склад менеджера: ${JSON.stringify(
        managerRole.warehouse
      )}`
    );

    if (managerRole.warehouse.shopId !== shopId) {
      this.logger.error(
        `[validateManagerAccessToWarehouse] Склад менеджера (${managerRole.warehouse.id}) не принадлежит магазину ${shopId}. Склад относится к магазину ${managerRole.warehouse.shopId}`
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

  @Post()
  create(
    @Body() createWarehouseServiceDto: CreateWarehouseServiceDto,
    @Request() req
  ) {
    this.logger.log(`[create] Создание услуги склада, userId=${req.user.id}`);
    return this.warehouseServicesService.create(
      createWarehouseServiceDto,
      req.user.id
    );
  }

  @Get('shop/:shopId')
  async findAllByShop(
    @Param('shopId') shopId: string,
    @Request() req,
    @Query('warehouseId') warehouseId?: string
  ) {
    this.logger.log(
      `[findAllByShop] Получение услуг склада для магазина ${shopId}${
        warehouseId ? `, склад ${warehouseId}` : ''
      }, userId=${req.user.id}`
    );

    try {
      let targetWarehouseId;

      // Если явно указан warehouseId в запросе, используем его
      if (warehouseId) {
        this.logger.debug(
          `[findAllByShop] Указан явный warehouseId=${warehouseId} в запросе`
        );

        // Проверяем, имеет ли менеджер доступ к этому складу
        const managerRole = await this.userRoleRepository.findOne({
          where: {
            userId: req.user.id,
            type: RoleType.MANAGER,
            warehouseId, // Явно указываем склад из запроса
            isActive: true,
          },
          relations: ['warehouse'],
        });

        if (!managerRole || !managerRole.warehouse) {
          this.logger.warn(
            `[findAllByShop] Менеджер ${req.user.id} не имеет доступа к складу ${warehouseId}`
          );

          // Проверяем, есть ли у пользователя роль менеджера вообще
          const anyManagerRole = await this.userRoleRepository.findOne({
            where: {
              userId: req.user.id,
              type: RoleType.MANAGER,
              isActive: true,
            },
            relations: ['warehouse'],
          });

          if (!anyManagerRole || !anyManagerRole.warehouse) {
            this.logger.error(
              `[findAllByShop] Роль менеджера не найдена для userId=${req.user.id}`
            );
            throw new ForbiddenException('У вас нет прав менеджера склада');
          }

          this.logger.warn(
            `[findAllByShop] Менеджер пытается получить услуги склада ${warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
          );
          throw new ForbiddenException('У вас нет доступа к указанному складу');
        }

        targetWarehouseId = warehouseId;
        this.logger.log(
          `[findAllByShop] Доступ подтвержден к складу ${warehouseId}`
        );
      } else {
        // Если warehouseId не указан, используем склад из роли менеджера
        this.logger.debug(
          `[findAllByShop] warehouseId не указан, определяем склад менеджера`
        );

        // Получаем роль менеджера для проверки магазина
        const managerRole = await this.userRoleRepository
          .createQueryBuilder('role')
          .innerJoinAndSelect('role.warehouse', 'warehouse')
          .where('role.userId = :userId', { userId: req.user.id })
          .andWhere('role.type = :type', { type: RoleType.MANAGER })
          .andWhere('role.isActive = :isActive', { isActive: true })
          .andWhere('warehouse.shopId = :shopId', { shopId })
          .getOne();

        // Если не нашли роль для этого магазина, ищем любую роль менеджера
        if (!managerRole || !managerRole.warehouse) {
          this.logger.debug(
            `[findAllByShop] Не найдена роль для магазина ${shopId}, ищем любую роль менеджера`
          );

          const anyManagerRole = await this.userRoleRepository.findOne({
            where: {
              userId: req.user.id,
              type: RoleType.MANAGER,
              isActive: true,
            },
            relations: ['warehouse'],
          });

          if (!anyManagerRole || !anyManagerRole.warehouse) {
            this.logger.error(
              `[findAllByShop] Роль менеджера не найдена для userId=${req.user.id}`
            );
            throw new ForbiddenException('У вас нет прав менеджера склада');
          }

          targetWarehouseId = anyManagerRole.warehouse.id;
          this.logger.debug(
            `[findAllByShop] Используем склад менеджера по умолчанию: ${targetWarehouseId}`
          );
        } else {
          targetWarehouseId = managerRole.warehouse.id;
          this.logger.debug(
            `[findAllByShop] Используем склад менеджера для магазина ${shopId}: ${targetWarehouseId}`
          );
        }
      }

      // Определяем, какой это магазин
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          warehouseId: targetWarehouseId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        relations: ['warehouse'],
      });

      const actualShopId = managerRole?.warehouse?.shopId || 'неизвестно';
      const warehouseName = managerRole?.warehouse?.name || 'Без имени';

      this.logger.log(
        `[findAllByShop] ИНФОРМАЦИЯ О ДОСТУПЕ:
        - Запрошенный shopId: ${shopId}
        - Используемый warehouseId: ${targetWarehouseId} (${warehouseName})
        - Магазин склада: ${actualShopId}
        - Пользователь: ${req.user.id}`
      );

      // Используем сервис для получения услуг конкретного склада менеджера
      this.logger.debug(
        `[findAllByShop] Запрос услуг для склада ${targetWarehouseId}`
      );
      const services =
        await this.warehouseServicesService.findByWarehouseId(
          targetWarehouseId
        );

      this.logger.log(
        `[findAllByShop] Успешно получены услуги: ${services.length} шт.`
      );
      return services;
    } catch (error) {
      this.logger.error(
        `[findAllByShop] Ошибка при получении услуг: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    this.logger.log(
      `[findOne] Получение услуги по ID ${id}, userId=${req.user.id}`
    );

    // Получаем информацию об услуге и проверяем доступ
    const service = await this.warehouseServicesService.findOne(
      id,
      req.user.id
    );

    this.logger.log(
      `[findOne] Успешно получена услуга ${id} со склада ${service.warehouseId}`
    );

    return service;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseServiceDto: any, // UpdateWarehouseServiceDto
    @Request() req
  ) {
    this.logger.log(`[update] Обновление услуги ${id}, userId=${req.user.id}`);

    // Сервис сам проверит доступ менеджера к складу услуги
    const updatedService = await this.warehouseServicesService.update(
      id,
      updateWarehouseServiceDto,
      req.user.id
    );

    this.logger.log(
      `[update] Успешно обновлена услуга ${id} со склада ${updatedService.warehouseId}`
    );

    return updatedService;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    this.logger.log(`[remove] Удаление услуги ${id}, userId=${req.user.id}`);

    // Сервис сам проверит доступ менеджера к складу услуги
    await this.warehouseServicesService.remove(id, req.user.id);

    this.logger.log(`[remove] Успешно удалена услуга ${id}`);

    return { success: true };
  }
}
