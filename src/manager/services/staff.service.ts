import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, RoleType } from '../../roles/entities/user-role.entity';
import { Invite, InviteStatus } from '../../invites/entities/invite.entity';
import { CreateStaffInviteDto } from '../dto/staff/create-staff-invite.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>
  ) {}

  private async validateManagerAccess(userId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        role: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера');
    }

    return managerRole;
  }

  async getStaff(userId: string) {
    const managerRole = await this.validateManagerAccess(userId);

    return this.userRoleRepository.find({
      where: {
        shopId: managerRole.shopId,
        isActive: true,
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async createInvite(
    createStaffInviteDto: CreateStaffInviteDto,
    userId: string
  ) {
    const managerRole = await this.validateManagerAccess(userId);

    // Проверяем, нет ли уже активного приглашения для этого номера телефона
    const existingInvite = await this.inviteRepository.findOne({
      where: {
        phone: createStaffInviteDto.phone,
        shopId: managerRole.shopId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new ForbiddenException(
        'Для этого номера телефона уже есть активное приглашение'
      );
    }

    // Проверяем, нет ли уже активной роли для этого номера телефона
    const existingRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .innerJoin('role.user', 'user')
      .where('user.phone = :phone', { phone: createStaffInviteDto.phone })
      .andWhere('role.shopId = :shopId', { shopId: managerRole.shopId })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingRole) {
      throw new ForbiddenException(
        'Пользователь с этим номером телефона уже является сотрудником'
      );
    }

    const invite = this.inviteRepository.create({
      ...createStaffInviteDto,
      shopId: managerRole.shopId,
      createdById: userId,
      status: InviteStatus.PENDING,
    });

    return this.inviteRepository.save(invite);
  }

  async getInvites(userId: string) {
    const managerRole = await this.validateManagerAccess(userId);

    return this.inviteRepository.find({
      where: {
        shopId: managerRole.shopId,
      },
      relations: ['invitedUser'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async deactivateStaff(staffId: string, userId: string) {
    const managerRole = await this.validateManagerAccess(userId);

    const staffRole = await this.userRoleRepository.findOne({
      where: {
        id: staffId,
        shopId: managerRole.shopId,
        isActive: true,
      },
      relations: ['user'],
    });

    if (!staffRole) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (staffRole.role !== RoleType.CASHIER) {
      throw new ForbiddenException('Вы можете деактивировать только кассиров');
    }

    staffRole.isActive = false;
    staffRole.deactivatedAt = new Date();

    return this.userRoleRepository.save(staffRole);
  }
}
