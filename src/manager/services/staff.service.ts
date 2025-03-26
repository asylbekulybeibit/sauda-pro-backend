import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { Invite, InviteStatus } from '../../invites/entities/invite.entity';
import { CreateStaffInviteDto } from '../dto/staff/create-staff-invite.dto';
import { InviteStatsDto } from '../dto/staff/invite-stats.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>
  ) {}

  private async validateManagerAccess(userId: string, warehouseId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера для этого склада');
    }

    return managerRole;
  }

  async getStaff(userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

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
      .where('warehouse.id = :warehouseId', { warehouseId })
      .andWhere('role.type IN (:...types)', {
        types: [RoleType.OWNER, RoleType.MANAGER, RoleType.CASHIER],
      })
      .orderBy('user.id', 'ASC')
      .addOrderBy('role.createdAt', 'DESC')
      .getMany();
  }

  async createInvite(
    createStaffInviteDto: CreateStaffInviteDto,
    userId: string,
    warehouseId: string
  ) {
    await this.validateManagerAccess(userId, warehouseId);

    // Если роль не указана или не является CASHIER, принудительно устанавливаем CASHIER
    if (
      !createStaffInviteDto.role ||
      createStaffInviteDto.role !== RoleType.CASHIER
    ) {
      createStaffInviteDto.role = RoleType.CASHIER;
    }

    // Проверяем, есть ли уже активное приглашение на такую же роль для этого телефона на этом складе
    const existingInvite = await this.inviteRepository.findOne({
      where: {
        phone: createStaffInviteDto.phone,
        warehouseId,
        role: createStaffInviteDto.role, // Добавляем проверку по роли
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new ForbiddenException(
        `Для этого номера телефона уже есть активное приглашение на роль ${this.getRoleName(
          createStaffInviteDto.role
        )} в этом складе`
      );
    }

    // Проверяем только наличие роли кассира для данного пользователя на этом складе
    const existingCashierRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .innerJoin('role.user', 'user')
      .where('user.phone = :phone', { phone: createStaffInviteDto.phone })
      .andWhere('role.warehouseId = :warehouseId', { warehouseId })
      .andWhere('role.type = :roleType', {
        roleType: RoleType.CASHIER,
      })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingCashierRole) {
      throw new ForbiddenException(
        'Этот номер телефона уже зарегистрирован как кассир в вашем складе'
      );
    }

    const invite = this.inviteRepository.create({
      ...createStaffInviteDto,
      warehouseId,
      createdById: userId,
      status: InviteStatus.PENDING,
      role: RoleType.CASHIER, // Явно устанавливаем роль CASHIER
    });

    return this.inviteRepository.save(invite);
  }

  async getInvites(userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    return this.inviteRepository.find({
      where: { warehouseId },
      relations: ['invitedUser', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async deactivateStaff(staffId: string, userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    const staffRole = await this.userRoleRepository.findOne({
      where: {
        id: staffId,
        warehouseId,
        isActive: true,
      },
      relations: ['user'],
    });

    if (!staffRole) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (staffRole.type !== RoleType.CASHIER) {
      throw new ForbiddenException('Вы можете деактивировать только кассиров');
    }

    staffRole.isActive = false;
    staffRole.deactivatedAt = new Date();

    return this.userRoleRepository.save(staffRole);
  }

  async getInviteStats(
    userId: string,
    warehouseId: string
  ): Promise<InviteStatsDto> {
    await this.validateManagerAccess(userId, warehouseId);

    const invites = await this.inviteRepository.find({
      where: { warehouseId },
      relations: ['invitedUser'],
    });

    const stats: InviteStatsDto = {
      total: invites.length,
      byStatus: {
        [InviteStatus.PENDING]: 0,
        [InviteStatus.ACCEPTED]: 0,
        [InviteStatus.REJECTED]: 0,
        [InviteStatus.CANCELLED]: 0,
      },
      byRole: {
        [RoleType.CASHIER]: 0,
        [RoleType.MANAGER]: 0,
        [RoleType.OWNER]: 0,
        [RoleType.SUPERADMIN]: 0,
      },
      activeInvites: 0,
      acceptedInvites: 0,
      rejectedInvites: 0,
      cancelledInvites: 0,
      averageAcceptanceTime: null,
    };

    let totalAcceptanceTime = 0;
    let acceptedCount = 0;

    invites.forEach((invite) => {
      stats.byStatus[invite.status]++;
      stats.byRole[invite.role]++;

      switch (invite.status) {
        case InviteStatus.PENDING:
          stats.activeInvites++;
          break;
        case InviteStatus.ACCEPTED:
          stats.acceptedInvites++;
          if (invite.statusChangedAt) {
            const acceptanceTime =
              invite.statusChangedAt.getTime() - invite.createdAt.getTime();
            totalAcceptanceTime += acceptanceTime;
            acceptedCount++;
          }
          break;
        case InviteStatus.REJECTED:
          stats.rejectedInvites++;
          break;
        case InviteStatus.CANCELLED:
          stats.cancelledInvites++;
          break;
      }
    });

    if (acceptedCount > 0) {
      stats.averageAcceptanceTime = totalAcceptanceTime / acceptedCount;
    }

    return stats;
  }

  async cancelInvite(
    inviteId: string,
    userId: string,
    warehouseId: string
  ): Promise<Invite> {
    await this.validateManagerAccess(userId, warehouseId);

    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, warehouseId },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException(
        'Можно отменить только ожидающие приглашения'
      );
    }

    invite.status = InviteStatus.CANCELLED;
    invite.statusChangedAt = new Date();

    return this.inviteRepository.save(invite);
  }

  async resendInvite(
    inviteId: string,
    userId: string,
    warehouseId: string
  ): Promise<Invite> {
    await this.validateManagerAccess(userId, warehouseId);

    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, warehouseId },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException(
        'Можно повторно отправить только ожидающие приглашения'
      );
    }

    // Обновляем время создания
    invite.createdAt = new Date();

    return this.inviteRepository.save(invite);
  }

  async getInviteHistory(
    userId: string,
    warehouseId: string
  ): Promise<Invite[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.inviteRepository.find({
      where: { warehouseId },
      relations: ['invitedUser', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  // Новые методы для работы с приглашениями на склад

  async getWarehouseInvites(userId: string, warehouseId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    return this.inviteRepository.find({
      where: { warehouseId },
      relations: ['invitedUser', 'createdBy', 'warehouse'],
      order: { createdAt: 'DESC' },
    });
  }

  async createWarehouseInvite(
    createStaffInviteDto: CreateStaffInviteDto,
    userId: string,
    warehouseId: string
  ) {
    const managerRole = await this.validateManagerAccess(userId, warehouseId);

    // Если роль не указана или не является CASHIER, принудительно устанавливаем CASHIER
    if (
      !createStaffInviteDto.role ||
      createStaffInviteDto.role !== RoleType.CASHIER
    ) {
      createStaffInviteDto.role = RoleType.CASHIER;
    }

    // Проверяем, есть ли уже активное приглашение на такую же роль для этого телефона на этом складе
    const existingInvite = await this.inviteRepository.findOne({
      where: {
        phone: createStaffInviteDto.phone,
        warehouseId,
        role: createStaffInviteDto.role, // Добавляем проверку по роли
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new ForbiddenException(
        `Для этого номера телефона уже есть активное приглашение на роль ${this.getRoleName(
          createStaffInviteDto.role
        )} в этом складе`
      );
    }

    // Проверяем только наличие роли кассира у пользователя
    // Проверка на роль менеджера удалена, так как пользователь может иметь разные роли
    const existingCashierRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .innerJoin('role.user', 'user')
      .where('user.phone = :phone', { phone: createStaffInviteDto.phone })
      .andWhere('role.warehouseId = :warehouseId', { warehouseId })
      .andWhere('role.type = :roleType', {
        roleType: RoleType.CASHIER,
      })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingCashierRole) {
      throw new ForbiddenException(
        'Этот номер телефона уже зарегистрирован как кассир в вашем складе'
      );
    }

    const invite = this.inviteRepository.create({
      ...createStaffInviteDto,
      warehouseId,
      createdById: userId,
      status: InviteStatus.PENDING,
      role: RoleType.CASHIER, // Явно устанавливаем роль CASHIER
    });

    // Установим shopId из связанного склада
    if (managerRole.warehouse && managerRole.warehouse.shopId) {
      invite.shopId = managerRole.warehouse.shopId;
    }

    return this.inviteRepository.save(invite);
  }

  // Вспомогательный метод для получения русского названия роли
  private getRoleName(role: RoleType): string {
    switch (role) {
      case RoleType.CASHIER:
        return 'кассир';
      case RoleType.MANAGER:
        return 'менеджер';
      case RoleType.OWNER:
        return 'владелец';
      case RoleType.SUPERADMIN:
        return 'администратор';
      default:
        return role;
    }
  }

  async getWarehouseInviteStats(
    userId: string,
    warehouseId: string
  ): Promise<InviteStatsDto> {
    await this.validateManagerAccess(userId, warehouseId);

    const invites = await this.inviteRepository.find({
      where: { warehouseId },
      relations: ['invitedUser'],
    });

    const stats: InviteStatsDto = {
      total: invites.length,
      byStatus: {
        [InviteStatus.PENDING]: 0,
        [InviteStatus.ACCEPTED]: 0,
        [InviteStatus.REJECTED]: 0,
        [InviteStatus.CANCELLED]: 0,
      },
      byRole: {
        [RoleType.CASHIER]: 0,
        [RoleType.MANAGER]: 0,
        [RoleType.OWNER]: 0,
        [RoleType.SUPERADMIN]: 0,
      },
      activeInvites: 0,
      acceptedInvites: 0,
      rejectedInvites: 0,
      cancelledInvites: 0,
      averageAcceptanceTime: null,
    };

    let totalAcceptanceTime = 0;
    let acceptedCount = 0;

    invites.forEach((invite) => {
      stats.byStatus[invite.status]++;
      stats.byRole[invite.role]++;

      switch (invite.status) {
        case InviteStatus.PENDING:
          stats.activeInvites++;
          break;
        case InviteStatus.ACCEPTED:
          stats.acceptedInvites++;
          if (invite.statusChangedAt) {
            const acceptanceTime =
              invite.statusChangedAt.getTime() - invite.createdAt.getTime();
            totalAcceptanceTime += acceptanceTime;
            acceptedCount++;
          }
          break;
        case InviteStatus.REJECTED:
          stats.rejectedInvites++;
          break;
        case InviteStatus.CANCELLED:
          stats.cancelledInvites++;
          break;
      }
    });

    if (acceptedCount > 0) {
      stats.averageAcceptanceTime = totalAcceptanceTime / acceptedCount;
    }

    return stats;
  }

  async cancelWarehouseInvite(
    inviteId: string,
    userId: string,
    warehouseId: string
  ): Promise<Invite> {
    await this.validateManagerAccess(userId, warehouseId);

    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, warehouseId },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException(
        'Можно отменить только ожидающие приглашения'
      );
    }

    invite.status = InviteStatus.CANCELLED;
    invite.statusChangedAt = new Date();

    return this.inviteRepository.save(invite);
  }

  async resendWarehouseInvite(
    inviteId: string,
    userId: string,
    warehouseId: string
  ): Promise<Invite> {
    await this.validateManagerAccess(userId, warehouseId);

    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, warehouseId },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException(
        'Можно повторно отправить только ожидающие приглашения'
      );
    }

    // Обновляем время создания
    invite.createdAt = new Date();

    return this.inviteRepository.save(invite);
  }
}
