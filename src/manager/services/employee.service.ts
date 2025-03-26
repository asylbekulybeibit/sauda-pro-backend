import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEmployeeDto } from '../dto/staff/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/staff/update-employee.dto';
import { Staff } from '../entities/staff.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(userId: string, warehouseId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: [
        {
          // Прямой доступ к складу
          userId,
          warehouseId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        {
          // Доступ через магазин (если менеджер магазина)
          userId,
          type: RoleType.MANAGER,
          isActive: true,
          warehouse: {
            id: warehouseId,
          },
        },
      ],
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера для этого склада');
    }

    return managerRole;
  }

  async findAllByShop(userId: string, shopId: string) {
    // Находим роль менеджера для этого пользователя, связанную с запрашиваемым магазином
    // Возможен вариант когда менеджер привязан напрямую к магазину или когда привязан к складу магазина
    const managerRole = await this.userRoleRepository.findOne({
      where: [
        {
          // Вариант 1: Менеджер напрямую связан с этим магазином
          userId,
          shopId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        {
          // Вариант 2: Менеджер связан со складом, который принадлежит этому магазину
          userId,
          type: RoleType.MANAGER,
          isActive: true,
          warehouse: {
            shopId,
          },
        },
      ],
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    let warehouseId: string;

    // Определяем warehouseId на основе типа доступа менеджера
    if (managerRole.warehouseId) {
      // Если менеджер привязан к складу, используем его warehouseId
      warehouseId = managerRole.warehouseId;
    } else {
      // Если менеджер привязан только к магазину, нужно найти основной склад магазина
      // или первый доступный склад
      const mainWarehouse = await this.userRoleRepository.manager
        .getRepository('warehouses')
        .findOne({
          where: [{ shopId, isMain: true }, { shopId }],
          order: { isMain: 'DESC', createdAt: 'ASC' },
        });

      if (!mainWarehouse) {
        throw new NotFoundException('Не найден склад для этого магазина');
      }

      warehouseId = mainWarehouse.id;
    }

    // Получаем только сотрудников, привязанных к конкретному складу менеджера
    return this.staffRepository.find({
      where: { warehouseId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async createByShop(
    createEmployeeDto: CreateEmployeeDto,
    userId: string,
    shopId: string
  ) {
    // Находим роль менеджера для этого пользователя, связанную с запрашиваемым магазином
    // Возможен вариант когда менеджер привязан напрямую к магазину или когда привязан к складу магазина
    const managerRole = await this.userRoleRepository.findOne({
      where: [
        {
          // Вариант 1: Менеджер напрямую связан с этим магазином
          userId,
          shopId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        {
          // Вариант 2: Менеджер связан со складом, который принадлежит этому магазину
          userId,
          type: RoleType.MANAGER,
          isActive: true,
          warehouse: {
            shopId,
          },
        },
      ],
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    let warehouseId: string;

    // Определяем warehouseId на основе типа доступа менеджера
    if (managerRole.warehouseId) {
      // Если менеджер привязан к складу, используем его warehouseId
      warehouseId = managerRole.warehouseId;
    } else {
      // Если менеджер привязан только к магазину, нужно найти основной склад магазина
      // или первый доступный склад
      const mainWarehouse = await this.userRoleRepository.manager
        .getRepository('warehouses')
        .findOne({
          where: [{ shopId, isMain: true }, { shopId }],
          order: { isMain: 'DESC', createdAt: 'ASC' },
        });

      if (!mainWarehouse) {
        throw new NotFoundException('Не найден склад для этого магазина');
      }

      warehouseId = mainWarehouse.id;
    }

    // Создаем сотрудника с правильными shopId и warehouseId
    const employee = this.staffRepository.create({
      ...createEmployeeDto,
      shopId,
      warehouseId,
      isWarehouseSpecific: true,
    });

    return this.staffRepository.save(employee);
  }

  async create(
    createEmployeeDto: CreateEmployeeDto,
    userId: string,
    warehouseId: string
  ) {
    const managerRole = await this.validateManagerAccess(userId, warehouseId);

    // Получаем shopId из роли менеджера или из склада
    let shopId: string;
    if (managerRole.shopId) {
      shopId = managerRole.shopId;
    } else if (managerRole.warehouse && managerRole.warehouse.shopId) {
      shopId = managerRole.warehouse.shopId;
    } else {
      // Получаем shopId из таблицы warehouses
      const warehouse = await this.userRoleRepository.manager
        .getRepository('warehouses')
        .findOne({
          where: { id: warehouseId },
        });

      if (!warehouse) {
        throw new NotFoundException('Склад не найден');
      }

      shopId = warehouse.shopId;
    }

    const employee = this.staffRepository.create({
      ...createEmployeeDto,
      warehouseId,
      shopId,
      isWarehouseSpecific: true, // Явно указываем, что сотрудник привязан к конкретному складу
    });

    return this.staffRepository.save(employee);
  }

  async findAll(userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    return this.staffRepository.find({
      where: { warehouseId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findAllActive(userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    return this.staffRepository.find({
      where: { warehouseId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    const employee = await this.staffRepository.findOne({
      where: { id, warehouseId },
    });

    if (!employee) {
      throw new NotFoundException('Сотрудник не найден');
    }

    return employee;
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
    userId: string,
    warehouseId: string
  ) {
    await this.validateManagerAccess(userId, warehouseId);

    const employee = await this.findOne(id, userId, warehouseId);

    // Обновляем только те поля, которые переданы в DTO
    Object.assign(employee, updateEmployeeDto);

    return this.staffRepository.save(employee);
  }

  async remove(id: string, userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    const employee = await this.findOne(id, userId, warehouseId);

    // Мягкое удаление - устанавливаем isActive в false
    employee.isActive = false;

    return this.staffRepository.save(employee);
  }

  async findOneByShop(id: string, userId: string, shopId: string) {
    // Находим роль менеджера для этого пользователя, связанную с запрашиваемым магазином
    const managerRole = await this.userRoleRepository.findOne({
      where: [
        {
          // Вариант 1: Менеджер напрямую связан с этим магазином
          userId,
          shopId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        {
          // Вариант 2: Менеджер связан со складом, который принадлежит этому магазину
          userId,
          type: RoleType.MANAGER,
          isActive: true,
          warehouse: {
            shopId,
          },
        },
      ],
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    let warehouseId: string;

    // Определяем warehouseId на основе типа доступа менеджера
    if (managerRole.warehouseId) {
      // Если менеджер привязан к складу, используем его warehouseId
      warehouseId = managerRole.warehouseId;
    } else {
      // Если менеджер привязан только к магазину, нужно найти основной склад магазина
      // или первый доступный склад
      const mainWarehouse = await this.userRoleRepository.manager
        .getRepository('warehouses')
        .findOne({
          where: [{ shopId, isMain: true }, { shopId }],
          order: { isMain: 'DESC', createdAt: 'ASC' },
        });

      if (!mainWarehouse) {
        throw new NotFoundException('Не найден склад для этого магазина');
      }

      warehouseId = mainWarehouse.id;
    }

    // Находим сотрудника конкретного склада
    const employee = await this.staffRepository.findOne({
      where: { id, warehouseId },
    });

    if (!employee) {
      throw new NotFoundException('Сотрудник не найден');
    }

    return employee;
  }

  async updateByShop(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
    userId: string,
    shopId: string
  ) {
    // Находим сотрудника, проверяя права доступа
    const employee = await this.findOneByShop(id, userId, shopId);

    // Обновляем только те поля, которые переданы в DTO
    Object.assign(employee, updateEmployeeDto);

    return this.staffRepository.save(employee);
  }

  async removeByShop(id: string, userId: string, shopId: string) {
    // Находим сотрудника, проверяя права доступа
    const employee = await this.findOneByShop(id, userId, shopId);

    // Мягкое удаление - устанавливаем isActive в false
    employee.isActive = false;

    return this.staffRepository.save(employee);
  }

  async findAllActiveByShop(userId: string, shopId: string) {
    // Находим роль менеджера для этого пользователя, связанную с запрашиваемым магазином
    // Возможен вариант когда менеджер привязан напрямую к магазину или когда привязан к складу магазина
    const managerRole = await this.userRoleRepository.findOne({
      where: [
        {
          // Вариант 1: Менеджер напрямую связан с этим магазином
          userId,
          shopId,
          type: RoleType.MANAGER,
          isActive: true,
        },
        {
          // Вариант 2: Менеджер связан со складом, который принадлежит этому магазину
          userId,
          type: RoleType.MANAGER,
          isActive: true,
          warehouse: {
            shopId,
          },
        },
      ],
      relations: ['warehouse', 'warehouse.shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    let warehouseId: string;

    // Определяем warehouseId на основе типа доступа менеджера
    if (managerRole.warehouseId) {
      // Если менеджер привязан к складу, используем его warehouseId
      warehouseId = managerRole.warehouseId;
    } else {
      // Если менеджер привязан только к магазину, нужно найти основной склад магазина
      // или первый доступный склад
      const mainWarehouse = await this.userRoleRepository.manager
        .getRepository('warehouses')
        .findOne({
          where: [{ shopId, isMain: true }, { shopId }],
          order: { isMain: 'DESC', createdAt: 'ASC' },
        });

      if (!mainWarehouse) {
        throw new NotFoundException('Не найден склад для этого магазина');
      }

      warehouseId = mainWarehouse.id;
    }

    // Получаем только активных сотрудников, привязанных к конкретному складу менеджера
    return this.staffRepository.find({
      where: { warehouseId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findAllByWarehouse(
    userId: string,
    shopId: string,
    warehouseId: string
  ) {
    try {
      console.log(
        `[EmployeeService.findAllByWarehouse] Запрос сотрудников для склада. userId: ${userId}, shopId: ${shopId}, warehouseId: ${warehouseId}`
      );

      // Проверка прав доступа менеджера к указанному складу и магазину
      const managerRole = await this.userRoleRepository.findOne({
        where: [
          {
            // Проверка доступа к конкретному складу
            userId,
            warehouseId,
            type: RoleType.MANAGER,
            isActive: true,
          },
          {
            // Проверка доступа к магазину
            userId,
            shopId,
            type: RoleType.MANAGER,
            isActive: true,
          },
          {
            // Проверка доступа через любой склад этого магазина
            userId,
            type: RoleType.MANAGER,
            isActive: true,
            warehouse: {
              shopId,
            },
          },
        ],
        relations: ['warehouse', 'warehouse.shop'],
      });

      console.log(
        `[EmployeeService.findAllByWarehouse] Найдена роль менеджера:`,
        managerRole ? 'Да' : 'Нет'
      );

      if (!managerRole) {
        // Дополнительная проверка - получим информацию о складе
        console.log(
          `[EmployeeService.findAllByWarehouse] Роль менеджера не найдена, проверяем дополнительно данные склада`
        );
        const warehouse = await this.userRoleRepository.manager
          .getRepository('warehouses')
          .findOne({
            where: { id: warehouseId },
            relations: ['shop'],
          });

        console.log(
          `[EmployeeService.findAllByWarehouse] Информация о складе:`,
          warehouse
        );

        if (warehouse && warehouse.shopId === shopId) {
          // Проверим, есть ли у пользователя права на магазин склада
          const shopManagerRole = await this.userRoleRepository.findOne({
            where: {
              userId,
              shopId: warehouse.shopId,
              type: RoleType.MANAGER,
              isActive: true,
            },
          });

          console.log(
            `[EmployeeService.findAllByWarehouse] Найдена роль менеджера магазина:`,
            shopManagerRole ? 'Да' : 'Нет'
          );

          if (shopManagerRole) {
            // Пользователь имеет права на магазин, к которому принадлежит склад
            console.log(
              `[EmployeeService.findAllByWarehouse] Пользователь имеет права менеджера для магазина склада`
            );
            // Продолжаем выполнение запроса
          } else {
            console.log(
              `[EmployeeService.findAllByWarehouse] Пользователь НЕ имеет прав менеджера для магазина склада`
            );
            throw new ForbiddenException(
              'У вас нет прав менеджера для этого склада'
            );
          }
        } else {
          console.log(
            `[EmployeeService.findAllByWarehouse] Склад не принадлежит указанному магазину`
          );
          throw new ForbiddenException(
            'У вас нет прав менеджера для этого склада'
          );
        }
      }

      // Возвращаем сотрудников только для указанного склада
      console.log(
        `[EmployeeService.findAllByWarehouse] Выполняем запрос на получение сотрудников склада ${warehouseId}`
      );
      const employees = await this.staffRepository.find({
        where: { warehouseId },
        order: { lastName: 'ASC', firstName: 'ASC' },
      });

      console.log(
        `[EmployeeService.findAllByWarehouse] Найдено сотрудников: ${employees.length}`
      );
      console.log(
        `[EmployeeService.findAllByWarehouse] Данные сотрудников:`,
        employees
      );

      return employees;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error in findAllByWarehouse:', error);
      throw new ForbiddenException('У вас нет прав менеджера для этого склада');
    }
  }

  async findAllActiveByWarehouse(
    userId: string,
    shopId: string,
    warehouseId: string
  ) {
    try {
      // Проверка прав доступа менеджера к указанному складу и магазину
      const managerRole = await this.userRoleRepository.findOne({
        where: [
          {
            // Проверка доступа к конкретному складу
            userId,
            warehouseId,
            type: RoleType.MANAGER,
            isActive: true,
          },
          {
            // Проверка доступа к магазину
            userId,
            shopId,
            type: RoleType.MANAGER,
            isActive: true,
          },
          {
            // Проверка доступа через любой склад этого магазина
            userId,
            type: RoleType.MANAGER,
            isActive: true,
            warehouse: {
              shopId,
            },
          },
        ],
        relations: ['warehouse', 'warehouse.shop'],
      });

      if (!managerRole) {
        // Дополнительная проверка - получим информацию о складе
        const warehouse = await this.userRoleRepository.manager
          .getRepository('warehouses')
          .findOne({
            where: { id: warehouseId },
            relations: ['shop'],
          });

        if (warehouse && warehouse.shopId === shopId) {
          // Проверим, есть ли у пользователя права на магазин склада
          const shopManagerRole = await this.userRoleRepository.findOne({
            where: {
              userId,
              shopId: warehouse.shopId,
              type: RoleType.MANAGER,
              isActive: true,
            },
          });

          if (shopManagerRole) {
            // Пользователь имеет права на магазин, к которому принадлежит склад
            // Продолжаем выполнение запроса
          } else {
            throw new ForbiddenException(
              'У вас нет прав менеджера для этого склада'
            );
          }
        } else {
          throw new ForbiddenException(
            'У вас нет прав менеджера для этого склада'
          );
        }
      }

      // Возвращаем только активных сотрудников для указанного склада
      return this.staffRepository.find({
        where: { warehouseId, isActive: true },
        order: { lastName: 'ASC', firstName: 'ASC' },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error in findAllActiveByWarehouse:', error);
      throw new ForbiddenException('У вас нет прав менеджера для этого склада');
    }
  }
}
