import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../shops/entities/shop.entity';
import { UserRole, RoleType } from '../roles/entities/user-role.entity';
import { Invite, InviteStatus } from '../invites/entities/invite.entity';
import { CreateOwnerInviteDto } from './dto/create-owner-invite.dto';

@Injectable()
export class OwnerService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
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
        return 'Неизвестная роль';
    }
  }

  async createInvite(
    createInviteDto: CreateOwnerInviteDto,
    ownerId: string
  ): Promise<Invite> {
    // Проверяем роль
    if (![RoleType.MANAGER, RoleType.CASHIER].includes(createInviteDto.role)) {
      throw new ForbiddenException(
        'Владелец может создавать только менеджеров и кассиров'
      );
    }

    // Проверяем, что магазин принадлежит владельцу
    const shop = await this.shopRepository
      .createQueryBuilder('shop')
      .innerJoin('shop.userRoles', 'role')
      .where('shop.id = :shopId', { shopId: createInviteDto.shopId })
      .andWhere('role.userId = :ownerId', { ownerId })
      .andWhere('role.role = :role', { role: RoleType.OWNER })
      .getOne();

    if (!shop) {
      throw new ForbiddenException('У вас нет прав для этого магазина');
    }

    // Проверяем, нет ли активной роли для этого номера в этом магазине
    const existingActiveRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .innerJoin('role.user', 'user')
      .where('user.phone = :phone', { phone: createInviteDto.phone })
      .andWhere('role.shopId = :shopId', { shopId: createInviteDto.shopId })
      .andWhere('role.role = :role', { role: createInviteDto.role })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();

    if (existingActiveRole) {
      throw new BadRequestException(
        `У пользователя уже есть активная роль "${this.getRoleName(
          createInviteDto.role
        )}" в этом магазине`
      );
    }

    // Проверяем, нет ли уже активного инвайта для этого номера и роли
    const existingInvite = await this.inviteRepository.findOne({
      where: {
        phone: createInviteDto.phone,
        role: createInviteDto.role,
        shopId: createInviteDto.shopId,
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
    // Получаем все магазины владельца
    const ownerShops = await this.shopRepository
      .createQueryBuilder('shop')
      .innerJoin('shop.userRoles', 'role')
      .where('role.userId = :ownerId', { ownerId })
      .andWhere('role.role = :role', { role: RoleType.OWNER })
      .getMany();

    const shopIds = ownerShops.map((shop) => shop.id);

    // Получаем все приглашения для магазинов владельца
    return this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.shop', 'shop')
      .leftJoinAndSelect('invite.createdBy', 'createdBy')
      .leftJoinAndSelect('invite.invitedUser', 'invitedUser')
      .where('invite.shopId IN (:...shopIds)', { shopIds })
      .orderBy('invite.createdAt', 'DESC')
      .getMany();
  }

  async cancelInvite(ownerId: string, inviteId: string): Promise<void> {
    const invite = await this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.shop', 'shop')
      .leftJoin('shop.userRoles', 'role')
      .where('invite.id = :inviteId', { inviteId })
      .andWhere('role.userId = :ownerId', { ownerId })
      .andWhere('role.role = :role', { role: RoleType.OWNER })
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

  async getShopStaff(ownerId: string, shopId: string): Promise<UserRole[]> {
    // Проверяем, что магазин принадлежит владельцу
    const shop = await this.shopRepository
      .createQueryBuilder('shop')
      .innerJoin('shop.userRoles', 'ownerRole')
      .where('shop.id = :shopId', { shopId })
      .andWhere('ownerRole.userId = :ownerId', { ownerId })
      .andWhere('ownerRole.role = :role', { role: RoleType.OWNER })
      .getOne();

    if (!shop) {
      throw new ForbiddenException('У вас нет прав для этого магазина');
    }

    // Получаем все роли сотрудников (активные и неактивные)
    return this.userRoleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.user', 'user')
      .leftJoinAndSelect('role.shop', 'shop')
      .select([
        'role.id',
        'role.role',
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
      .where('role.shopId = :shopId', { shopId })
      .andWhere('role.role IN (:...roles)', {
        roles: [RoleType.OWNER, RoleType.MANAGER, RoleType.CASHIER],
      })
      .orderBy('user.id', 'ASC')
      .addOrderBy('role.createdAt', 'DESC')
      .getMany();
  }

  async removeStaffMember(ownerId: string, staffId: string): Promise<void> {
    const staffRole = await this.userRoleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.shop', 'shop')
      .leftJoin('shop.userRoles', 'ownerRole')
      .where('role.id = :staffId', { staffId })
      .andWhere('ownerRole.userId = :ownerId', { ownerId })
      .andWhere('ownerRole.role = :role', { role: RoleType.OWNER })
      .getOne();

    if (!staffRole) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (!staffRole.isActive) {
      throw new ForbiddenException('Сотрудник уже деактивирован');
    }

    staffRole.isActive = false;
    staffRole.deactivatedAt = new Date();
    await this.userRoleRepository.save(staffRole);
  }

  async getShopInvites(ownerId: string, shopId: string): Promise<Invite[]> {
    // Проверяем, что магазин принадлежит владельцу
    const shop = await this.shopRepository
      .createQueryBuilder('shop')
      .innerJoin('shop.userRoles', 'role')
      .where('shop.id = :shopId', { shopId })
      .andWhere('role.userId = :ownerId', { ownerId })
      .andWhere('role.role = :role', { role: RoleType.OWNER })
      .getOne();

    if (!shop) {
      throw new ForbiddenException('У вас нет прав для этого магазина');
    }

    // Получаем все приглашения для конкретного магазина
    return this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.shop', 'shop')
      .leftJoinAndSelect('invite.createdBy', 'createdBy')
      .leftJoinAndSelect('invite.invitedUser', 'invitedUser')
      .where('invite.shopId = :shopId', { shopId })
      .orderBy('invite.createdAt', 'DESC')
      .getMany();
  }
}
