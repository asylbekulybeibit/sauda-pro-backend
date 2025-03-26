import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    this.logger.debug(
      `[validateManagerAccess] Проверка доступа пользователя ${userId} к складу ${warehouseId}`
    );

    // Проверяем, что пользователь является менеджером и имеет доступ к указанному складу
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        warehouseId, // Явно указываем, что нужна роль для конкретного склада
        isActive: true,
      },
      relations: ['warehouse'],
    });

    this.logger.debug(
      `[validateManagerAccess] Найдена роль: ${JSON.stringify(
        managerRole || 'не найдено'
      )}`
    );

    if (!managerRole) {
      this.logger.error(
        `[validateManagerAccess] Роль менеджера не найдена для userId=${userId} и warehouseId=${warehouseId}`
      );
      throw new ForbiddenException('У вас нет прав менеджера склада');
    }

    if (!managerRole.warehouse) {
      this.logger.error(
        `[validateManagerAccess] Склад не найден для менеджера userId=${userId}`
      );
      throw new ForbiddenException('Склад не найден');
    }

    this.logger.log(
      `[validateManagerAccess] Доступ подтвержден для userId=${userId}, warehouseId=${warehouseId}`
    );
  }

  async create(
    userId: string,
    createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    this.logger.log(
      `[create] Создание поставщика для склада ${
        createSupplierDto.warehouseId
      }, userId=${userId}, данные=${JSON.stringify(createSupplierDto)}`
    );
    await this.validateManagerAccess(userId, createSupplierDto.warehouseId);

    const supplier = this.suppliersRepository.create(createSupplierDto);
    const savedSupplier = await this.suppliersRepository.save(supplier);

    this.logger.log(
      `[create] Поставщик успешно создан: ID=${savedSupplier.id}, name=${savedSupplier.name}, warehouseId=${savedSupplier.warehouseId}`
    );

    return savedSupplier;
  }

  async findAll(userId: string, warehouseId: string): Promise<Supplier[]> {
    this.logger.log(
      `[findAll] Получение поставщиков для склада ${warehouseId}, userId=${userId}`
    );

    try {
      // Проверяем доступ менеджера к складу
      await this.validateManagerAccess(userId, warehouseId);

      // Получаем детальную информацию о складе для логов
      const warehouseInfo = await this.userRoleRepository
        .createQueryBuilder('role')
        .innerJoinAndSelect('role.warehouse', 'warehouse')
        .leftJoinAndSelect('warehouse.shop', 'shop')
        .where('role.userId = :userId', { userId })
        .andWhere('role.type = :type', { type: RoleType.MANAGER })
        .andWhere('role.isActive = :isActive', { isActive: true })
        .andWhere('warehouse.id = :warehouseId', { warehouseId })
        .getOne();

      if (warehouseInfo && warehouseInfo.warehouse) {
        this.logger.log(
          `[findAll] === ИНФОРМАЦИЯ О СКЛАДЕ И ДОСТУПЕ МЕНЕДЖЕРА ===
          - ID склада: ${warehouseId}
          - Название склада: ${warehouseInfo.warehouse.name || 'Без названия'}
          - ID магазина: ${warehouseInfo.warehouse.shopId}
          - Название магазина: ${
            warehouseInfo.warehouse.shop?.name || 'Неизвестно'
          }
          - Адрес склада: ${warehouseInfo.warehouse.address || 'Не указан'}
          - ID роли менеджера: ${warehouseInfo.id}
          - Дата создания роли: ${warehouseInfo.createdAt}
          - Время запроса: ${new Date().toISOString()}
          ================================================`
        );
      }

      // Получаем поставщиков только для данного склада
      const suppliers = await this.suppliersRepository.find({
        where: { warehouseId, isActive: true },
        order: { name: 'ASC' },
      });

      // Подробный лог по найденным поставщикам
      this.logger.log(
        `[findAll] Найдено ${suppliers.length} поставщиков для склада ${warehouseId}`
      );

      // Выводим краткую информацию о первых 5 поставщиках для диагностики
      if (suppliers.length > 0) {
        const supplierSample = suppliers.slice(0, 5).map((s) => ({
          id: s.id,
          name: s.name,
          warehouseId: s.warehouseId,
          contactPerson: s.contactPerson,
          isActive: s.isActive,
        }));

        this.logger.debug(
          `[findAll] Примеры поставщиков склада ${warehouseId}: ${JSON.stringify(
            supplierSample
          )}`
        );
      } else {
        this.logger.debug(
          `[findAll] Для склада ${warehouseId} не найдено активных поставщиков`
        );
      }

      return suppliers;
    } catch (error) {
      this.logger.error(
        `[findAll] Ошибка при получении поставщиков: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async findAllByShop(userId: string, shopId: string): Promise<Supplier[]> {
    this.logger.log(
      `[findAllByShop] Получение поставщиков для магазина ${shopId}, userId=${userId}`
    );

    try {
      // Проверяем, что пользователь является менеджером и имеет доступ к указанному магазину
      // Сначала пытаемся найти роль именно для этого магазина
      const managerRole = await this.userRoleRepository
        .createQueryBuilder('role')
        .innerJoinAndSelect('role.warehouse', 'warehouse')
        .where('role.userId = :userId', { userId })
        .andWhere('role.type = :type', { type: RoleType.MANAGER })
        .andWhere('role.isActive = :isActive', { isActive: true })
        .andWhere('warehouse.shopId = :shopId', { shopId })
        .getOne();

      // Если нашли роль для этого магазина, значит у менеджера есть доступ
      if (managerRole) {
        this.logger.debug(
          `[findAllByShop] Найдена роль менеджера для магазина ${shopId}: ${JSON.stringify(
            {
              roleId: managerRole.id,
              warehouseId: managerRole.warehouse.id,
              warehouseName: managerRole.warehouse.name,
            }
          )}`
        );
      } else {
        // Если не нашли роль именно для этого магазина, проверяем, есть ли у пользователя роль менеджера вообще
        const anyManagerRole = await this.userRoleRepository.findOne({
          where: {
            userId,
            type: RoleType.MANAGER,
            isActive: true,
          },
        });

        if (!anyManagerRole) {
          this.logger.error(
            `[findAllByShop] У пользователя нет роли менеджера для userId=${userId}`
          );
          throw new ForbiddenException('У вас нет прав менеджера склада');
        }

        this.logger.warn(
          `[findAllByShop] У менеджера ${userId} нет доступа к магазину ${shopId}, но есть роль менеджера`
        );
      }

      // Получаем склады, принадлежащие указанному магазину
      this.logger.debug(
        `[findAllByShop] Поиск поставщиков для всех складов магазина ${shopId}`
      );

      // Поиск поставщиков для указанного магазина
      const suppliers = await this.suppliersRepository
        .createQueryBuilder('supplier')
        .innerJoin(
          'warehouses',
          'warehouse',
          'supplier.warehouseId = warehouse.id'
        )
        .leftJoinAndSelect('supplier.warehouse', 'warehouseDetails')
        .where('warehouse.shopId = :shopId', { shopId })
        .andWhere('supplier.isActive = :isActive', { isActive: true })
        .orderBy('supplier.name', 'ASC')
        .getMany();

      this.logger.debug(
        `[findAllByShop] Найдено ${
          suppliers.length
        } поставщиков для магазина ${shopId}: ${JSON.stringify(
          suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            warehouseId: s.warehouseId,
            warehouseName: s.warehouse?.name,
          }))
        )}`
      );

      return suppliers;
    } catch (error) {
      this.logger.error(
        `[findAllByShop] Ошибка при получении поставщиков: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async findOne(
    userId: string,
    warehouseId: string,
    id: string
  ): Promise<Supplier> {
    this.logger.log(
      `[findOne] Получение поставщика ${id}${
        warehouseId ? ` для склада ${warehouseId}` : ''
      }, userId=${userId}`
    );

    try {
      // Если указан warehouseId, проверяем доступ менеджера к складу
      if (warehouseId) {
        await this.validateManagerAccess(userId, warehouseId);

        const supplier = await this.suppliersRepository.findOne({
          where: { id, warehouseId, isActive: true },
        });

        if (!supplier) {
          this.logger.warn(
            `[findOne] Поставщик ${id} не найден для склада ${warehouseId}`
          );
          throw new NotFoundException('Supplier not found');
        }

        return supplier;
      } else {
        // Если warehouseId не указан, просто находим поставщика по ID
        // Это используется контроллером для начальной проверки
        const supplier = await this.suppliersRepository.findOne({
          where: { id, isActive: true },
        });

        if (!supplier) {
          this.logger.warn(`[findOne] Поставщик ${id} не найден`);
          throw new NotFoundException('Supplier not found');
        }

        return supplier;
      }
    } catch (error) {
      this.logger.error(
        `[findOne] Ошибка при получении поставщика: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async update(
    userId: string,
    warehouseId: string,
    id: string,
    updateData: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    this.logger.log(
      `[update] Обновление поставщика ${id} для склада ${warehouseId}, userId=${userId}`
    );

    await this.validateManagerAccess(userId, warehouseId);

    const supplier = await this.findOne(userId, warehouseId, id);
    Object.assign(supplier, updateData);

    return this.suppliersRepository.save(supplier);
  }

  async remove(userId: string, warehouseId: string, id: string): Promise<void> {
    this.logger.log(
      `[remove] Удаление поставщика ${id} для склада ${warehouseId}, userId=${userId}`
    );

    await this.validateManagerAccess(userId, warehouseId);

    const supplier = await this.findOne(userId, warehouseId, id);
    supplier.isActive = false;

    await this.suppliersRepository.save(supplier);
  }
}
