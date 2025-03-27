import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  Logger,
  ForbiddenException,
  Post,
  Body,
  NotFoundException,
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
    @Query('isService') isService?: string,
    @Query('warehouseId') warehouseId?: string
  ) {
    this.logger.log(
      `[getWarehouseProductsByShop] Получение товаров склада для магазина ${shopId}${
        warehouseId ? `, склад ${warehouseId}` : ''
      }, userId=${req.user.id}`
    );

    try {
      let targetWarehouseId;

      // Если явно указан warehouseId в запросе, используем его
      if (warehouseId) {
        this.logger.debug(
          `[getWarehouseProductsByShop] Указан явный warehouseId=${warehouseId} в запросе`
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
            `[getWarehouseProductsByShop] Менеджер ${req.user.id} не имеет доступа к складу ${warehouseId}`
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
              `[getWarehouseProductsByShop] Роль менеджера не найдена для userId=${req.user.id}`
            );
            throw new ForbiddenException('У вас нет прав менеджера склада');
          }

          this.logger.warn(
            `[getWarehouseProductsByShop] Менеджер пытается получить товары склада ${warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
          );
          throw new ForbiddenException('У вас нет доступа к указанному складу');
        }

        targetWarehouseId = warehouseId;
        this.logger.log(
          `[getWarehouseProductsByShop] Доступ подтвержден к складу ${warehouseId}`
        );
      } else {
        // Если warehouseId не указан, используем склад из роли менеджера
        this.logger.debug(
          `[getWarehouseProductsByShop] warehouseId не указан, определяем склад менеджера`
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
            `[getWarehouseProductsByShop] Не найдена роль для магазина ${shopId}, ищем любую роль менеджера`
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
              `[getWarehouseProductsByShop] Роль менеджера не найдена для userId=${req.user.id}`
            );
            throw new ForbiddenException('У вас нет прав менеджера склада');
          }

          targetWarehouseId = anyManagerRole.warehouse.id;
          this.logger.debug(
            `[getWarehouseProductsByShop] Используем склад менеджера по умолчанию: ${targetWarehouseId}`
          );
        } else {
          targetWarehouseId = managerRole.warehouse.id;
          this.logger.debug(
            `[getWarehouseProductsByShop] Используем склад менеджера для магазина ${shopId}: ${targetWarehouseId}`
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
        `[getWarehouseProductsByShop] ИНФОРМАЦИЯ О ДОСТУПЕ:
        - Запрошенный shopId: ${shopId}
        - Используемый warehouseId: ${targetWarehouseId} (${warehouseName})
        - Магазин склада: ${actualShopId}
        - Пользователь: ${req.user.id}`
      );

      // Преобразуем строковый параметр isService в boolean, если он предоставлен
      const isServiceBoolean = isService ? isService === 'true' : undefined;
      this.logger.debug(
        `[getWarehouseProductsByShop] Параметр isService=${isService}, преобразован в ${isServiceBoolean}`
      );

      // Используем сервис для получения товаров конкретного склада менеджера
      this.logger.debug(
        `[getWarehouseProductsByShop] Запрос товаров для склада ${targetWarehouseId}`
      );
      const products =
        await this.warehouseProductsService.getWarehouseProductsByWarehouseId(
          targetWarehouseId,
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

  // Добавляем метод для создания товара на складе
  @Post()
  async createWarehouseProduct(@Body() createProductDto: any, @Request() req) {
    this.logger.log(
      `[createWarehouseProduct] Создание товара на складе, userId=${req.user.id}`
    );

    try {
      // Получаем роль менеджера для определения склада
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
          `[createWarehouseProduct] Роль менеджера не найдена для userId=${req.user.id}`
        );
        throw new ForbiddenException('У вас нет прав менеджера склада');
      }

      // Преобразуем входные данные в формат, ожидаемый сервисом
      const productDto = {
        warehouseId: createProductDto.warehouseId || managerRole.warehouse.id,
        barcodeId: createProductDto.barcodeId,
        barcode: createProductDto.barcode,
        name:
          createProductDto.name ||
          createProductDto.productName ||
          'Новый товар',
        description: createProductDto.description || '',
        categoryId: createProductDto.categoryId,
        quantity: createProductDto.quantity || 0,
        purchasePrice:
          createProductDto.price || createProductDto.purchasePrice || 0,
        sellingPrice:
          createProductDto.price || createProductDto.sellingPrice || 0,
        minQuantity: createProductDto.minQuantity || 0,
        isActive: true,
      };

      this.logger.debug(
        `[createWarehouseProduct] Создание товара для склада ${productDto.warehouseId}`
      );

      this.logger.debug(
        `[createWarehouseProduct] Данные товара: ${JSON.stringify(productDto)}`
      );

      // Используем сервис для создания товара
      return this.warehouseProductsService.createWarehouseProduct(productDto);
    } catch (error) {
      this.logger.error(
        `[createWarehouseProduct] Ошибка при создании товара: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
