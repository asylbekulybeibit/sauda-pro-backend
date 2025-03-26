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
  ParseUUIDPipe,
  Logger,
  ForbiddenException,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { Supplier } from '../entities/supplier.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';

@Controller('manager/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class SuppliersController {
  private readonly logger = new Logger(SuppliersController.name);

  constructor(
    private readonly suppliersService: SuppliersService,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>
  ) {}

  @Post()
  async create(
    @Request() req,
    @Body() createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    this.logger.log(
      `[create] Создание поставщика для пользователя ${
        req.user.id
      }, данные: ${JSON.stringify(createSupplierDto)}`
    );

    // Если warehouseId не указан явно, находим склад менеджера
    if (!createSupplierDto.warehouseId) {
      this.logger.debug(
        `[create] warehouseId не указан, определяем склад менеджера`
      );

      try {
        // Получаем любую активную роль менеджера
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
            `[create] Роль менеджера не найдена для userId=${req.user.id}`
          );
          throw new ForbiddenException('У вас нет прав менеджера склада');
        }

        // Устанавливаем warehouseId из роли менеджера
        createSupplierDto.warehouseId = managerRole.warehouse.id;

        this.logger.log(
          `[create] Автоматически установлен склад менеджера: ${
            createSupplierDto.warehouseId
          } (${managerRole.warehouse.name || 'Без имени'})`
        );
      } catch (error) {
        this.logger.error(
          `[create] Ошибка при определении склада менеджера: ${error.message}`,
          error.stack
        );
        throw error;
      }
    } else {
      // Если warehouseId был указан явно, проверяем что менеджер имеет доступ к этому складу
      this.logger.debug(
        `[create] warehouseId указан явно: ${createSupplierDto.warehouseId}, проверяем доступ`
      );

      try {
        // Ищем именно роль менеджера для запрашиваемого склада
        const managerRole = await this.userRoleRepository.findOne({
          where: {
            userId: req.user.id,
            type: RoleType.MANAGER,
            warehouseId: createSupplierDto.warehouseId, // Явно указываем, что нужна роль для конкретного склада
            isActive: true,
          },
          relations: ['warehouse'],
        });

        // Если не нашли роль для этого склада
        if (!managerRole || !managerRole.warehouse) {
          this.logger.warn(
            `[create] Менеджер ${req.user.id} не имеет активной роли для склада ${createSupplierDto.warehouseId}`
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
              `[create] Роль менеджера не найдена для userId=${req.user.id}`
            );
            throw new ForbiddenException('У вас нет прав менеджера склада');
          }

          this.logger.warn(
            `[create] Менеджер пытается создать поставщика для склада ${createSupplierDto.warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
          );
          throw new ForbiddenException('У вас нет доступа к указанному складу');
        }

        this.logger.log(
          `[create] Доступ подтвержден к складу ${createSupplierDto.warehouseId}`
        );
      } catch (error) {
        this.logger.error(
          `[create] Ошибка при проверке доступа к складу: ${error.message}`,
          error.stack
        );
        throw error;
      }
    }

    return this.suppliersService.create(req.user.id, createSupplierDto);
  }

  @Get('warehouse/:warehouseId')
  async findAll(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Supplier[]> {
    this.logger.log(
      `[findAll] Получение поставщиков для склада с ID=${warehouseId}, userId=${req.user.id}`
    );

    try {
      // Ищем именно роль менеджера для запрашиваемого склада
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          warehouseId: warehouseId, // Явно указываем, что нужна роль для конкретного склада
          isActive: true,
        },
        relations: ['warehouse', 'warehouse.shop'],
      });

      // Если не нашли роль для этого склада
      if (!managerRole || !managerRole.warehouse) {
        this.logger.warn(
          `[findAll] Менеджер ${req.user.id} не имеет активной роли для склада ${warehouseId}`
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
            `[findAll] Роль менеджера не найдена для userId=${req.user.id}`
          );
          throw new ForbiddenException('У вас нет прав менеджера склада');
        }

        this.logger.warn(
          `[findAll] Менеджер пытается получить поставщиков для склада ${warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
        );
        throw new ForbiddenException('У вас нет доступа к указанному складу');
      }

      const shopId = managerRole.warehouse.shopId;
      const warehouseName = managerRole.warehouse.name || 'Без имени';
      const shopName = managerRole.warehouse.shop?.name || 'Без имени';

      this.logger.log(
        `[findAll] ИНФОРМАЦИЯ О ДОСТУПЕ:
        - Запрошенный warehouseId в URL: ${warehouseId}
        - Магазин менеджера: ${shopId} (${shopName})
        - Склад менеджера: ${managerRole.warehouse.id} (${warehouseName})
        - Пользователь: ${req.user.id}`
      );

      // Получаем поставщиков для конкретного склада
      return this.suppliersService.findAll(req.user.id, warehouseId);
    } catch (error) {
      this.logger.error(
        `[findAll] Ошибка при получении поставщиков: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Get('shop/:shopId/supplier/:id')
  async findOne(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Supplier> {
    this.logger.log(
      `[findOne] Получение поставщика по ID ${id}, для магазина ${shopId}, userId=${req.user.id}`
    );

    try {
      // Сначала получаем информацию о поставщике, чтобы узнать его warehouseId
      const supplier = await this.suppliersRepository.findOne({
        where: { id, isActive: true },
      });

      if (!supplier) {
        this.logger.warn(`[findOne] Поставщик с ID ${id} не найден`);
        throw new NotFoundException(`Поставщик с ID ${id} не найден`);
      }

      this.logger.debug(
        `[findOne] Найден поставщик: ${JSON.stringify({
          id: supplier.id,
          name: supplier.name,
          warehouseId: supplier.warehouseId,
        })}`
      );

      // Теперь проверяем, имеет ли менеджер доступ к складу этого поставщика
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          warehouseId: supplier.warehouseId, // Указываем именно склад поставщика
          isActive: true,
        },
        relations: ['warehouse'],
      });

      if (!managerRole || !managerRole.warehouse) {
        this.logger.warn(
          `[findOne] Менеджер ${req.user.id} не имеет доступа к складу поставщика ${supplier.warehouseId}`
        );

        // Проверяем, есть ли у менеджера роли вообще
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
            `[findOne] Роль менеджера не найдена для userId=${req.user.id}`
          );
          throw new ForbiddenException('У вас нет прав менеджера склада');
        }

        this.logger.warn(
          `[findOne] Менеджер пытается получить поставщика со склада ${supplier.warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
        );
        throw new ForbiddenException(
          'У вас нет доступа к указанному поставщику'
        );
      }

      this.logger.log(
        `[findOne] Доступ подтвержден к поставщику ${id} на складе ${supplier.warehouseId}`
      );

      // Используем ID склада поставщика для получения данных
      return this.suppliersService.findOne(
        req.user.id,
        supplier.warehouseId,
        id
      );
    } catch (error) {
      this.logger.error(
        `[findOne] Ошибка при получении поставщика: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Patch('shop/:shopId/supplier/:id')
  async update(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    this.logger.log(
      `[update] Обновление поставщика ${id}, для магазина ${shopId}, userId=${req.user.id}`
    );

    try {
      // Сначала получаем информацию о поставщике, чтобы узнать его warehouseId
      const supplier = await this.suppliersRepository.findOne({
        where: { id, isActive: true },
      });

      if (!supplier) {
        this.logger.warn(`[update] Поставщик с ID ${id} не найден`);
        throw new NotFoundException(`Поставщик с ID ${id} не найден`);
      }

      this.logger.debug(
        `[update] Найден поставщик: ${JSON.stringify({
          id: supplier.id,
          name: supplier.name,
          warehouseId: supplier.warehouseId,
        })}`
      );

      // Теперь проверяем, имеет ли менеджер доступ к складу этого поставщика
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          warehouseId: supplier.warehouseId, // Указываем именно склад поставщика
          isActive: true,
        },
        relations: ['warehouse'],
      });

      if (!managerRole || !managerRole.warehouse) {
        this.logger.warn(
          `[update] Менеджер ${req.user.id} не имеет доступа к складу поставщика ${supplier.warehouseId}`
        );

        // Проверяем, есть ли у менеджера роли вообще
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
            `[update] Роль менеджера не найдена для userId=${req.user.id}`
          );
          throw new ForbiddenException('У вас нет прав менеджера склада');
        }

        this.logger.warn(
          `[update] Менеджер пытается обновить поставщика со склада ${supplier.warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
        );
        throw new ForbiddenException(
          'У вас нет доступа к указанному поставщику'
        );
      }

      this.logger.log(
        `[update] Доступ подтвержден к поставщику ${id} на складе ${supplier.warehouseId}`
      );

      // Используем ID склада поставщика для обновления данных
      return this.suppliersService.update(
        req.user.id,
        supplier.warehouseId,
        id,
        updateSupplierDto
      );
    } catch (error) {
      this.logger.error(
        `[update] Ошибка при обновлении поставщика: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Delete('shop/:shopId/supplier/:id')
  async remove(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    this.logger.log(
      `[remove] Удаление поставщика ${id}, для магазина ${shopId}, userId=${req.user.id}`
    );

    try {
      // Сначала получаем информацию о поставщике, чтобы узнать его warehouseId
      const supplier = await this.suppliersRepository.findOne({
        where: { id, isActive: true },
      });

      if (!supplier) {
        this.logger.warn(`[remove] Поставщик с ID ${id} не найден`);
        throw new NotFoundException(`Поставщик с ID ${id} не найден`);
      }

      this.logger.debug(
        `[remove] Найден поставщик: ${JSON.stringify({
          id: supplier.id,
          name: supplier.name,
          warehouseId: supplier.warehouseId,
        })}`
      );

      // Теперь проверяем, имеет ли менеджер доступ к складу этого поставщика
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          warehouseId: supplier.warehouseId, // Указываем именно склад поставщика
          isActive: true,
        },
        relations: ['warehouse'],
      });

      if (!managerRole || !managerRole.warehouse) {
        this.logger.warn(
          `[remove] Менеджер ${req.user.id} не имеет доступа к складу поставщика ${supplier.warehouseId}`
        );

        // Проверяем, есть ли у менеджера роли вообще
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
            `[remove] Роль менеджера не найдена для userId=${req.user.id}`
          );
          throw new ForbiddenException('У вас нет прав менеджера склада');
        }

        this.logger.warn(
          `[remove] Менеджер пытается удалить поставщика со склада ${supplier.warehouseId}, но имеет доступ только к складу ${anyManagerRole.warehouse.id}`
        );
        throw new ForbiddenException(
          'У вас нет доступа к указанному поставщику'
        );
      }

      this.logger.log(
        `[remove] Доступ подтвержден к поставщику ${id} на складе ${supplier.warehouseId}`
      );

      // Используем ID склада поставщика для удаления
      return this.suppliersService.remove(
        req.user.id,
        supplier.warehouseId,
        id
      );
    } catch (error) {
      this.logger.error(
        `[remove] Ошибка при удалении поставщика: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
