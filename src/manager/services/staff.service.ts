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

  private async validateManagerAccess(userId: string, shopId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    return managerRole;
  }

  async getStaff(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    // Получаем все роли сотрудников (активные и неактивные)
    return this.userRoleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.user', 'user')
      .leftJoinAndSelect('role.shop', 'shop')
      .select([
        'role.id',
        'role.type',
        'role.isActive',
        'role.createdAt',
        'role.deactivatedAt',
        'role.shopId',
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.phone',
        'shop.id',
        'shop.name',
        'shop.type',
        'shop.address',
      ])
      .where('shop.id = :shopId', { shopId })
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
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const existingInvite = await this.inviteRepository.findOne({
      where: {
        phone: createStaffInviteDto.phone,
        shopId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new ForbiddenException(
        'Для этого номера телефона уже есть активное приглашение'
      );
    }

    const existingRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .innerJoin('role.user', 'user')
      .where('user.phone = :phone', { phone: createStaffInviteDto.phone })
      .andWhere('role.shopId = :shopId', { shopId })
      .andWhere('role.type = :roleType', {
        roleType: createStaffInviteDto.role,
      })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingRole) {
      throw new ForbiddenException(
        'Этот номер телефона уже зарегистрирован как кассир в вашем магазине'
      );
    }

    const invite = this.inviteRepository.create({
      ...createStaffInviteDto,
      shopId,
      createdById: userId,
      status: InviteStatus.PENDING,
    });

    return this.inviteRepository.save(invite);
  }

  async getInvites(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.inviteRepository.find({
      where: { shopId },
      relations: ['invitedUser', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async deactivateStaff(staffId: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const staffRole = await this.userRoleRepository.findOne({
      where: {
        id: staffId,
        shopId,
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
    shopId: string
  ): Promise<InviteStatsDto> {
    await this.validateManagerAccess(userId, shopId);

    const invites = await this.inviteRepository.find({
      where: { shopId },
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
    shopId: string
  ): Promise<Invite> {
    await this.validateManagerAccess(userId, shopId);

    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, shopId },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        'Можно отменить только активные приглашения'
      );
    }

    invite.status = InviteStatus.CANCELLED;
    invite.statusChangedAt = new Date();

    return this.inviteRepository.save(invite);
  }

  async resendInvite(
    inviteId: string,
    userId: string,
    shopId: string
  ): Promise<Invite> {
    await this.validateManagerAccess(userId, shopId);

    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, shopId },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        'Можно повторно отправить только активные приглашения'
      );
    }

    // Обновляем время создания и сбрасываем OTP
    invite.createdAt = new Date();
    invite.otp = null;
    invite.otpExpiresAt = null;

    const savedInvite = await this.inviteRepository.save(invite);

    // TODO: Добавить отправку уведомления через NotificationsService

    return savedInvite;
  }

  async getInviteHistory(userId: string, shopId: string): Promise<Invite[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.inviteRepository.find({
      where: { shopId },
      relations: ['invitedUser', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
