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
    private readonly userRoleRepository: Repository<UserRole>
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
        // Получаем роль менеджера для определения его склада
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
          `[create] Автоматически установлен склад менеджера: ${createSupplierDto.warehouseId}`
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
        // Получаем роль менеджера
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

        // Проверяем, что указанный склад совпадает со складом менеджера
        if (managerRole.warehouse.id !== createSupplierDto.warehouseId) {
          this.logger.warn(
            `[create] Менеджер пытается создать поставщика для склада ${createSupplierDto.warehouseId}, но имеет доступ только к складу ${managerRole.warehouse.id}`
          );
          throw new ForbiddenException('У вас нет доступа к указанному складу');
        }
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

    // Получаем роль менеджера для определения его склада
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId: req.user.id,
        shopId, // Проверяем, что менеджер принадлежит к этому магазину
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    if (!managerRole || !managerRole.warehouse) {
      this.logger.error(
        `[findOne] Роль менеджера не найдена для userId=${req.user.id} и shopId=${shopId}`
      );
      throw new ForbiddenException(
        'У вас нет прав менеджера склада для этого магазина'
      );
    }

    const warehouseId = managerRole.warehouse.id;
    this.logger.log(
      `[findOne] Запрошен магазин: ${shopId}, используем склад менеджера: ${warehouseId}`
    );

    // Используем ID склада менеджера для получения поставщика
    return this.suppliersService.findOne(req.user.id, warehouseId, id);
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

    // Получаем роль менеджера для определения его склада
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId: req.user.id,
        shopId, // Проверяем, что менеджер принадлежит к этому магазину
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    if (!managerRole || !managerRole.warehouse) {
      this.logger.error(
        `[update] Роль менеджера не найдена для userId=${req.user.id} и shopId=${shopId}`
      );
      throw new ForbiddenException(
        'У вас нет прав менеджера склада для этого магазина'
      );
    }

    const warehouseId = managerRole.warehouse.id;
    this.logger.log(
      `[update] Запрошен магазин: ${shopId}, используем склад менеджера: ${warehouseId}`
    );

    // Используем ID склада менеджера для обновления поставщика
    return this.suppliersService.update(
      req.user.id,
      warehouseId,
      id,
      updateSupplierDto
    );
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

    // Получаем роль менеджера для определения его склада
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId: req.user.id,
        shopId, // Проверяем, что менеджер принадлежит к этому магазину
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    if (!managerRole || !managerRole.warehouse) {
      this.logger.error(
        `[remove] Роль менеджера не найдена для userId=${req.user.id} и shopId=${shopId}`
      );
      throw new ForbiddenException(
        'У вас нет прав менеджера склада для этого магазина'
      );
    }

    const warehouseId = managerRole.warehouse.id;
    this.logger.log(
      `[remove] Запрошен магазин: ${shopId}, используем склад менеджера: ${warehouseId}`
    );

    // Используем ID склада менеджера для удаления поставщика
    return this.suppliersService.remove(req.user.id, warehouseId, id);
  }
}
