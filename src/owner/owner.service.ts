import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite, InviteStatus } from '../invites/entities/invite.entity';
import { CreateOwnerInviteDto } from './dto/create-owner-invite.dto';
import { RoleType } from '../auth/types/role.type';
import { UserRole } from '../roles/entities/user-role.entity';
import { Warehouse } from '../manager/entities/warehouse.entity';
import { In, Brackets } from 'typeorm';
import { Shop } from '../shops/entities/shop.entity';

@Injectable()
export class OwnerService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>
  ) {}

  private getRoleName(role: RoleType): string {
    switch (role) {
      case RoleType.OWNER:
        return 'Владелец';
      case RoleType.MANAGER:
        return 'Менеджер';
      case RoleType.CASHIER:
        return 'Кассир';
      default:
        return role;
    }
  }

  async createInvite(
    createInviteDto: CreateOwnerInviteDto,
    ownerId: string
  ): Promise<Invite> {
    // Получаем информацию о пользователе, включая признак суперадмина
    const ownerRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!ownerRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = ownerRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на склад
    if (!isSuperAdmin && createInviteDto.warehouseId) {
      // Получаем склад
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: createInviteDto.warehouseId },
        relations: ['shop'],
      });

      if (!warehouse) {
        throw new NotFoundException('Склад не найден');
      }

      // Проверяем, владеет ли пользователь магазином, к которому относится склад
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: warehouse.shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('У вас нет прав для этого склада');
      }
    }

    // Проверяем, нет ли активной роли для этого номера в этом складе
    const existingActiveRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .innerJoin('role.user', 'user')
      .where('user.phone = :phone', { phone: createInviteDto.phone })
      .andWhere('role.warehouseId = :warehouseId', {
        warehouseId: createInviteDto.warehouseId,
      })
      .andWhere('role.type = :type', { type: createInviteDto.role })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingActiveRole) {
      throw new BadRequestException(
        `У пользователя уже есть активная роль "${this.getRoleName(
          createInviteDto.role
        )}" в этом складе`
      );
    }

    // Проверяем, нет ли уже активного инвайта для этого номера и роли
    const existingInvite = await this.inviteRepository.findOne({
      where: {
        phone: createInviteDto.phone,
        role: createInviteDto.role,
        warehouseId: createInviteDto.warehouseId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new BadRequestException(
        'Активное приглашение для этого номера и роли уже существует'
      );
    }

    // Создаем новый инвайт
    const invite = this.inviteRepository.create({
      ...createInviteDto,
      createdById: ownerId,
      status: InviteStatus.PENDING,
    });

    return this.inviteRepository.save(invite);
  }

  async getOwnerInvites(ownerId: string): Promise<Invite[]> {
    // Получаем информацию о пользователе, включая признак суперадмина
    const ownerRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!ownerRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = ownerRole.user.isSuperAdmin;

    // Если суперадмин, возвращаем все приглашения
    let invites: Invite[] = [];
    if (isSuperAdmin) {
      invites = await this.inviteRepository.find({
        relations: ['warehouse', 'shop', 'createdBy', 'invitedUser'],
        order: { createdAt: 'DESC' },
      });
    } else {
      // Для обычного владельца получаем его магазины
      const ownerShops = await this.userRoleRepository.find({
        where: {
          userId: ownerId,
          type: RoleType.OWNER,
          isActive: true,
        },
        select: ['shopId'],
      });

      const shopIds = ownerShops
        .filter((role) => role.shopId)
        .map((role) => role.shopId);

      if (shopIds.length === 0) {
        return [];
      }

      // Получаем все склады, принадлежащие этим магазинам
      const warehouses = await this.warehouseRepository.find({
        where: { shopId: In(shopIds) },
      });

      const warehouseIds = warehouses.map((warehouse) => warehouse.id);

      // Получаем приглашения для магазинов владельца и всех его складов
      invites = await this.inviteRepository
        .createQueryBuilder('invite')
        .leftJoinAndSelect('invite.warehouse', 'warehouse')
        .leftJoinAndSelect('invite.shop', 'shop')
        .leftJoinAndSelect('invite.createdBy', 'createdBy')
        .leftJoinAndSelect('invite.invitedUser', 'invitedUser')
        .where(
          new Brackets((qb) => {
            qb.where('invite.shopId IN (:...shopIds)', { shopIds }).orWhere(
              'invite.warehouseId IN (:...warehouseIds)',
              { warehouseIds }
            );
          })
        )
        .orderBy('invite.createdAt', 'DESC')
        .getMany();
    }

    // Для каждого инвайта без warehouse, но с warehouseId, дозагружаем warehouse
    for (const invite of invites) {
      if (!invite.warehouse && invite.warehouseId) {
        invite.warehouse = await this.warehouseRepository.findOne({
          where: { id: invite.warehouseId },
        });
      }
    }

    return invites;
  }

  async cancelInvite(ownerId: string, inviteId: string): Promise<void> {
    // Получаем приглашение
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
      relations: ['warehouse', 'shop'],
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException(
        'Можно отменить только ожидающие приглашения'
      );
    }

    // Получаем информацию о пользователе, включая признак суперадмина
    const ownerRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!ownerRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = ownerRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на склад
    if (!isSuperAdmin) {
      // Если приглашение для склада
      if (invite.warehouseId) {
        // Получаем склад
        const warehouse = await this.warehouseRepository.findOne({
          where: { id: invite.warehouseId },
          relations: ['shop'],
        });

        if (!warehouse) {
          throw new NotFoundException('Склад не найден');
        }

        // Проверяем, владеет ли пользователь магазином, к которому относится склад
        const hasAccess = await this.userRoleRepository.findOne({
          where: {
            userId: ownerId,
            shopId: warehouse.shopId,
            type: RoleType.OWNER,
            isActive: true,
          },
        });

        if (!hasAccess) {
          throw new ForbiddenException(
            'У вас нет прав для отмены этого приглашения'
          );
        }
      }
      // Если приглашение для магазина
      else if (invite.shopId) {
        // Проверяем, владеет ли пользователь этим магазином
        const hasShopAccess = await this.userRoleRepository.findOne({
          where: {
            userId: ownerId,
            shopId: invite.shopId,
            type: RoleType.OWNER,
            isActive: true,
          },
        });

        if (!hasShopAccess) {
          throw new ForbiddenException(
            'У вас нет прав для отмены этого приглашения'
          );
        }
      }
    }

    // Сохраняем важные данные перед изменением статуса
    const warehouseId = invite.warehouseId;
    const shopId = invite.shopId;

    // Устанавливаем статус CANCELLED и дату изменения статуса
    invite.status = InviteStatus.CANCELLED;
    invite.statusChangedAt = new Date();

    // Убедимся, что информация о складе и магазине не теряется
    if (warehouseId) {
      invite.warehouseId = warehouseId;
    }
    if (shopId) {
      invite.shopId = shopId;
    }

    // Сохраняем изменения
    await this.inviteRepository.save(invite);
  }

  async getWarehouseStaff(
    ownerId: string,
    warehouseId: string
  ): Promise<UserRole[]> {
    // Получаем информацию о пользователе, включая признак суперадмина
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!userRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = userRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на склад
    if (!isSuperAdmin) {
      // Получаем склад
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: warehouseId },
        relations: ['shop'],
      });

      if (!warehouse) {
        throw new NotFoundException('Склад не найден');
      }

      // Проверяем, владеет ли пользователь магазином, к которому относится склад
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: warehouse.shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('У вас нет прав для этого склада');
      }
    }

    // Получаем все роли сотрудников (активные и неактивные)
    return this.userRoleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.user', 'user')
      .leftJoinAndSelect('role.warehouse', 'warehouse')
      .select([
        'role.id',
        'role.type',
        'role.isActive',
        'role.createdAt',
        'role.deactivatedAt',
        'role.warehouseId',
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.phone',
        'warehouse.id',
        'warehouse.name',
        'warehouse.address',
      ])
      .where('role.warehouseId = :warehouseId', { warehouseId })
      .andWhere('role.type IN (:...types)', {
        types: [RoleType.OWNER, RoleType.MANAGER, RoleType.CASHIER],
      })
      .orderBy('user.id', 'ASC')
      .addOrderBy('role.createdAt', 'DESC')
      .getMany();
  }

  async removeStaffMember(ownerId: string, staffId: string): Promise<void> {
    // Получаем роль сотрудника, которого хотим удалить
    const staffRole = await this.userRoleRepository.findOne({
      where: { id: staffId },
      relations: ['warehouse', 'user'],
    });

    if (!staffRole) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (!staffRole.isActive) {
      throw new ForbiddenException('Сотрудник уже деактивирован');
    }

    // Получаем информацию о пользователе, включая признак суперадмина
    const ownerRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!ownerRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = ownerRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на склад
    if (!isSuperAdmin) {
      // Получаем склад сотрудника
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: staffRole.warehouseId },
        relations: ['shop'],
      });

      if (!warehouse) {
        throw new NotFoundException('Склад не найден');
      }

      // Проверяем, владеет ли пользователь магазином, к которому относится склад
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: warehouse.shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException(
          'У вас нет прав для деактивации этого сотрудника'
        );
      }
    }

    // Обновляем оба поля при деактивации
    const now = new Date();
    staffRole.isActive = false;
    staffRole.deactivatedAt = now;
    await this.userRoleRepository.save(staffRole);
  }

  async getWarehouseInvites(
    ownerId: string,
    warehouseId: string
  ): Promise<Invite[]> {
    // Получаем информацию о пользователе, включая признак суперадмина
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!userRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = userRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на склад
    if (!isSuperAdmin) {
      // Получаем склад
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: warehouseId },
        relations: ['shop'],
      });

      if (!warehouse) {
        throw new NotFoundException('Склад не найден');
      }

      // Проверяем, владеет ли пользователь магазином, к которому относится склад
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: warehouse.shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('У вас нет прав для этого склада');
      }
    }

    // Получаем все приглашения для конкретного склада
    return this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.warehouse', 'warehouse')
      .leftJoinAndSelect('invite.createdBy', 'createdBy')
      .leftJoinAndSelect('invite.invitedUser', 'invitedUser')
      .where('invite.warehouseId = :warehouseId', { warehouseId })
      .orderBy('invite.createdAt', 'DESC')
      .getMany();
  }

  async getShopStaff(ownerId: string, shopId: string): Promise<UserRole[]> {
    // Получаем информацию о пользователе, включая признак суперадмина
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!userRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = userRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на магазин
    if (!isSuperAdmin) {
      // Проверяем, владеет ли пользователь этим магазином
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('У вас нет прав для этого магазина');
      }
    }

    // Получаем все склады, принадлежащие этому магазину
    const warehouses = await this.warehouseRepository.find({
      where: { shopId: shopId },
    });

    const warehouseIds = warehouses.map((warehouse) => warehouse.id);

    // Получаем все роли сотрудников (активные и неактивные)
    // - сотрудников непосредственно магазина
    // - сотрудников всех складов магазина
    return this.userRoleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.user', 'user')
      .leftJoinAndSelect('role.warehouse', 'warehouse')
      .leftJoinAndSelect('role.shop', 'shop')
      .select([
        'role.id',
        'role.type',
        'role.isActive',
        'role.createdAt',
        'role.deactivatedAt',
        'role.warehouseId',
        'role.shopId',
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.phone',
        'warehouse.id',
        'warehouse.name',
        'warehouse.address',
        'shop.id',
        'shop.name',
        'shop.address',
      ])
      .where(
        new Brackets((qb) => {
          qb.where('role.shopId = :shopId', { shopId }).orWhere(
            'role.warehouseId IN (:...warehouseIds)',
            { warehouseIds: warehouseIds.length > 0 ? warehouseIds : [''] }
          );
        })
      )
      .andWhere('role.type IN (:...types)', {
        types: [RoleType.OWNER, RoleType.MANAGER, RoleType.CASHIER],
      })
      .orderBy('user.id', 'ASC')
      .addOrderBy('role.createdAt', 'DESC')
      .getMany();
  }

  async getShopById(ownerId: string, shopId: string) {
    // Получаем информацию о пользователе, включая признак суперадмина
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!userRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = userRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на магазин
    if (!isSuperAdmin) {
      // Проверяем, владеет ли пользователь этим магазином
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('У вас нет прав для этого магазина');
      }
    }

    // Получаем магазин из репозитория Shop
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException(`Магазин с ID ${shopId} не найден`);
    }

    return shop;
  }

  async getShopInvites(ownerId: string, shopId: string): Promise<Invite[]> {
    // Получаем информацию о пользователе, включая признак суперадмина
    const ownerRole = await this.userRoleRepository.findOne({
      where: {
        userId: ownerId,
        type: RoleType.OWNER,
      },
      relations: ['user'],
    });

    if (!ownerRole) {
      throw new ForbiddenException('У вас нет прав владельца');
    }

    // Проверяем, является ли пользователь суперадмином
    const isSuperAdmin = ownerRole.user.isSuperAdmin;

    // Если не суперадмин, проверяем права на магазин
    if (!isSuperAdmin) {
      // Проверяем, владеет ли пользователь указанным магазином
      const hasAccess = await this.userRoleRepository.findOne({
        where: {
          userId: ownerId,
          shopId: shopId,
          type: RoleType.OWNER,
          isActive: true,
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('У вас нет прав для этого магазина');
      }
    }

    // Получаем все склады, принадлежащие этому магазину
    const warehouses = await this.warehouseRepository.find({
      where: { shopId, isActive: true },
    });

    const warehouseIds = warehouses.map((warehouse) => warehouse.id);

    // Получаем приглашения для магазина и всех его складов
    const invites = await this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.warehouse', 'warehouse')
      .leftJoinAndSelect('invite.shop', 'shop')
      .leftJoinAndSelect('invite.createdBy', 'createdBy')
      .leftJoinAndSelect('invite.invitedUser', 'invitedUser')
      .where(
        new Brackets((qb) => {
          qb.where('invite.shopId = :shopId', { shopId });
          if (warehouseIds.length > 0) {
            qb.orWhere('invite.warehouseId IN (:...warehouseIds)', {
              warehouseIds,
            });
          }
        })
      )
      .orderBy('invite.createdAt', 'DESC')
      .getMany();

    // Для каждого инвайта без warehouse, но с warehouseId, дозагружаем warehouse
    for (const invite of invites) {
      if (!invite.warehouse && invite.warehouseId) {
        invite.warehouse = await this.warehouseRepository.findOne({
          where: { id: invite.warehouseId },
        });
      }
    }

    return invites;
  }
}
