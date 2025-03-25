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

@Injectable()
export class OwnerService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>
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
    // Проверяем, что склад принадлежит владельцу
    const warehouse = await this.warehouseRepository
      .createQueryBuilder('warehouse')
      .innerJoin('warehouse.userRoles', 'role')
      .where('warehouse.id = :warehouseId', {
        warehouseId: createInviteDto.warehouseId,
      })
      .andWhere('role.userId = :ownerId', { ownerId })
      .andWhere('role.type = :type', { type: RoleType.OWNER })
      .getOne();

    if (!warehouse) {
      throw new ForbiddenException('У вас нет прав для этого склада');
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
    // Получаем все склады владельца
    const ownerWarehouses = await this.warehouseRepository
      .createQueryBuilder('warehouse')
      .innerJoin('warehouse.userRoles', 'role')
      .where('role.userId = :ownerId', { ownerId })
      .andWhere('role.type = :type', { type: RoleType.OWNER })
      .getMany();

    const warehouseIds = ownerWarehouses.map((warehouse) => warehouse.id);

    // Получаем все приглашения для складов владельца
    return this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.warehouse', 'warehouse')
      .leftJoinAndSelect('invite.createdBy', 'createdBy')
      .leftJoinAndSelect('invite.invitedUser', 'invitedUser')
      .where('invite.warehouseId IN (:...warehouseIds)', { warehouseIds })
      .orderBy('invite.createdAt', 'DESC')
      .getMany();
  }

  async cancelInvite(ownerId: string, inviteId: string): Promise<void> {
    const invite = await this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.warehouse', 'warehouse')
      .leftJoin('warehouse.userRoles', 'role')
      .where('invite.id = :inviteId', { inviteId })
      .andWhere('role.userId = :ownerId', { ownerId })
      .andWhere('role.type = :type', { type: RoleType.OWNER })
      .getOne();

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException(
        'Можно отменить только ожидающие приглашения'
      );
    }

    invite.status = InviteStatus.CANCELLED;
    await this.inviteRepository.save(invite);
  }

  async getWarehouseStaff(
    ownerId: string,
    warehouseId: string
  ): Promise<UserRole[]> {
    // Проверяем, что склад принадлежит владельцу
    const warehouse = await this.warehouseRepository
      .createQueryBuilder('warehouse')
      .innerJoin('warehouse.userRoles', 'ownerRole')
      .where('warehouse.id = :warehouseId', { warehouseId })
      .andWhere('ownerRole.userId = :ownerId', { ownerId })
      .andWhere('ownerRole.type = :type', { type: RoleType.OWNER })
      .getOne();

    if (!warehouse) {
      throw new ForbiddenException('У вас нет прав для этого склада');
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
        'warehouse.type',
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
    const staffRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.warehouse', 'warehouse')
      .leftJoin('warehouse.userRoles', 'ownerRole')
      .where('role.id = :staffId', { staffId })
      .andWhere('ownerRole.userId = :ownerId', { ownerId })
      .andWhere('ownerRole.type = :type', { type: RoleType.OWNER })
      .getOne();

    if (!staffRole) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (!staffRole.isActive) {
      throw new ForbiddenException('Сотрудник уже деактивирован');
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
    // Проверяем, что склад принадлежит владельцу
    const warehouse = await this.warehouseRepository
      .createQueryBuilder('warehouse')
      .innerJoin('warehouse.userRoles', 'role')
      .where('warehouse.id = :warehouseId', { warehouseId })
      .andWhere('role.userId = :ownerId', { ownerId })
      .andWhere('role.type = :type', { type: RoleType.OWNER })
      .getOne();

    if (!warehouse) {
      throw new ForbiddenException('У вас нет прав для этого склада');
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
}
