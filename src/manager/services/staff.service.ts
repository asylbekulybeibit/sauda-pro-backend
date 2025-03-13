import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
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
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingRole) {
      throw new ForbiddenException(
        'Пользователь с этим номером телефона уже является сотрудником'
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
      relations: ['invitedUser'],
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
}
