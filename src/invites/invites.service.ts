import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite, InviteStatus } from './entities/invite.entity';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RoleType } from '../auth/types/role.type';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { CreateUserRoleDto } from '../roles/dto/create-user-role.dto';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  private getRoleName(role: RoleType): string {
    switch (role) {
      case RoleType.SUPERADMIN:
        return 'Администратор';
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

  constructor(
    @InjectRepository(Invite)
    private invitesRepository: Repository<Invite>,
    private usersService: UsersService,
    private rolesService: RolesService
  ) {}

  async create(createInviteDto: CreateInviteDto, createdById: string) {
    const creator = await this.usersService.findOne(createdById);
    const normalizedPhone = normalizePhoneNumber(createInviteDto.phone);

    this.logger.debug(`Создание инвайта для номера ${normalizedPhone}`);

    // Проверяем, существует ли пользователь с таким номером
    const existingUser = await this.usersService.findByPhone(normalizedPhone);

    if (existingUser) {
      // Проверяем, есть ли у пользователя уже такая роль в этом проекте
      // Если warehouseId не указан, проверяем по shopId
      if (createInviteDto.warehouseId) {
        const existingRoles = await this.rolesService.findByUserAndWarehouse(
          existingUser.id,
          createInviteDto.warehouseId
        );

        this.logger.debug(
          `Найдены роли для пользователя: ${JSON.stringify(existingRoles)}`
        );

        // Проверяем только активные роли
        const hasActiveRole = existingRoles.some(
          (role) => role.type === createInviteDto.role && role.isActive
        );

        if (hasActiveRole) {
          throw new BadRequestException(
            `У пользователя уже есть роль "${this.getRoleName(
              createInviteDto.role
            )}" в этом проекте`
          );
        }
      } else if (createInviteDto.shopId) {
        // TODO: Если необходимо, добавить проверку существующих ролей по shopId
      }
    }

    // Проверяем, нет ли уже активного инвайта для этого номера на эту роль в этом проекте
    const existingInvites = await this.invitesRepository.find({
      where: {
        phone: normalizedPhone,
        status: InviteStatus.PENDING,
      },
    });

    this.logger.debug(
      `Найдены существующие инвайты: ${JSON.stringify(existingInvites)}`
    );

    let duplicateInvite;

    if (createInviteDto.warehouseId) {
      duplicateInvite = existingInvites.find(
        (invite) =>
          invite.role === createInviteDto.role &&
          invite.warehouseId === createInviteDto.warehouseId
      );
    } else if (createInviteDto.shopId) {
      duplicateInvite = existingInvites.find(
        (invite) =>
          invite.role === createInviteDto.role &&
          invite.shopId === createInviteDto.shopId
      );
    }

    if (duplicateInvite) {
      throw new BadRequestException(
        `Активный инвайт на роль "${this.getRoleName(
          createInviteDto.role
        )}" в этом проекте уже существует для номера ${normalizedPhone}`
      );
    }

    const invite = this.invitesRepository.create({
      phone: normalizedPhone,
      role: createInviteDto.role,
      warehouseId: createInviteDto.warehouseId,
      shopId: createInviteDto.shopId,
      createdById: creator.id,
      status: InviteStatus.PENDING,
    });

    await this.invitesRepository.save(invite);
    this.logger.debug(`Отправка инвайта на WhatsApp: ${normalizedPhone}`);

    return invite;
  }

  async createAdminInvite(createAdminInviteDto: any, createdById: string) {
    const creator = await this.usersService.findOne(createdById);
    if (!creator.isSuperAdmin) {
      throw new ForbiddenException(
        'Только администратор может создавать инвайты владельцев'
      );
    }

    const normalizedPhone = normalizePhoneNumber(createAdminInviteDto.phone);

    // Проверяем, существует ли пользователь с таким номером
    const existingUser = await this.usersService.findByPhone(normalizedPhone);

    if (existingUser) {
      // Если указан warehouseId, проверяем роли по складу
      if (createAdminInviteDto.warehouseId) {
        // Проверяем, есть ли у пользователя уже роль владельца в этом складе
        const existingRoles = await this.rolesService.findByUserAndWarehouse(
          existingUser.id,
          createAdminInviteDto.warehouseId
        );

        const hasActiveRole = existingRoles.some(
          (role) => role.type === RoleType.OWNER && role.isActive
        );

        if (hasActiveRole) {
          throw new BadRequestException(
            `У пользователя уже есть роль "Владелец" в этом складе`
          );
        }
      }
      // Если указан только shopId, проверяем роли по магазину
      else if (createAdminInviteDto.shopId) {
        const existingRoles = await this.rolesService.findByUserAndShopOnly(
          existingUser.id,
          createAdminInviteDto.shopId
        );

        const hasActiveRole = existingRoles.some(
          (role) => role.type === RoleType.OWNER && role.isActive
        );

        if (hasActiveRole) {
          throw new BadRequestException(
            `У пользователя уже есть роль "Владелец" в этом магазине`
          );
        }
      }
    }

    // Проверяем, нет ли уже активного инвайта для этого номера на роль владельца в этом магазине
    const existingInvites = await this.invitesRepository.find({
      where: {
        phone: normalizedPhone,
        status: InviteStatus.PENDING,
      },
    });

    let duplicateInvite;

    if (createAdminInviteDto.warehouseId) {
      duplicateInvite = existingInvites.find(
        (invite) =>
          invite.role === RoleType.OWNER &&
          invite.warehouseId === createAdminInviteDto.warehouseId
      );
    } else if (createAdminInviteDto.shopId) {
      duplicateInvite = existingInvites.find(
        (invite) =>
          invite.role === RoleType.OWNER &&
          invite.shopId === createAdminInviteDto.shopId &&
          !invite.warehouseId
      );
    }

    if (duplicateInvite) {
      throw new BadRequestException(
        `Активный инвайт на роль "Владелец" в этом магазине уже существует для номера ${normalizedPhone}`
      );
    }

    const invite = this.invitesRepository.create({
      phone: normalizedPhone,
      role: RoleType.OWNER,
      shopId: createAdminInviteDto.shopId,
      warehouseId: createAdminInviteDto.warehouseId,
      createdById: creator.id,
      status: InviteStatus.PENDING,
    });

    await this.invitesRepository.save(invite);
    this.logger.debug(
      `Отправка инвайта владельца на WhatsApp: ${normalizedPhone}`
    );

    return invite;
  }

  async findAll(): Promise<Invite[]> {
    return this.invitesRepository.find({
      relations: ['createdBy', 'invitedUser', 'warehouse', 'shop'],
    });
  }

  async findOne(id: string): Promise<Invite> {
    const invite = await this.invitesRepository.findOne({
      where: { id },
      relations: ['createdBy', 'invitedUser', 'warehouse', 'shop'],
    });

    if (!invite) {
      throw new NotFoundException(`Инвайт с ID ${id} не найден`);
    }

    return invite;
  }

  async findByPhone(phone: string): Promise<Invite | null> {
    const normalizedPhone = normalizePhoneNumber(phone);
    return this.invitesRepository.findOne({
      where: { phone: normalizedPhone, status: InviteStatus.PENDING },
      relations: ['createdBy', 'warehouse', 'shop'],
    });
  }

  async findPendingInvitesByPhone(phone: string): Promise<Invite[]> {
    const normalizedPhone = normalizePhoneNumber(phone);
    return this.invitesRepository.find({
      where: {
        phone: normalizedPhone,
        status: InviteStatus.PENDING,
      },
      relations: ['createdBy', 'warehouse', 'shop'],
    });
  }

  async findRejectedInvites(): Promise<Invite[]> {
    return this.invitesRepository.find({
      where: {
        status: InviteStatus.REJECTED,
      },
      relations: ['createdBy', 'invitedUser', 'warehouse', 'shop'],
      order: {
        statusChangedAt: 'DESC',
      },
    });
  }

  async acceptInvite(id: string, userId: string): Promise<Invite> {
    const invite = await this.findOne(id);
    const user = await this.usersService.findOne(userId);

    // Проверяем, что инвайт предназначен этому пользователю
    if (
      normalizePhoneNumber(user.phone) !== normalizePhoneNumber(invite.phone)
    ) {
      throw new ForbiddenException(
        'Этот инвайт предназначен другому пользователю'
      );
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Этот инвайт уже не является активным');
    }

    // Создаем роль для пользователя
    const createUserRoleDto: CreateUserRoleDto = {
      userId: user.id,
      type: invite.role,
    };

    // Добавляем warehoueId только если он есть
    if (invite.warehouseId) {
      createUserRoleDto.warehouseId = invite.warehouseId;
    }

    // Добавляем shopId если он есть
    if (invite.shopId) {
      createUserRoleDto.shopId = invite.shopId;
    }

    await this.rolesService.create(createUserRoleDto);

    // Обновляем статус инвайта
    invite.status = InviteStatus.ACCEPTED;
    invite.statusChangedAt = new Date();
    invite.invitedUser = user;
    invite.invitedUserId = user.id;

    return this.invitesRepository.save(invite);
  }

  async rejectInvite(id: string, userId: string): Promise<void> {
    const invite = await this.findOne(id);
    const user = await this.usersService.findOne(userId);

    // Проверяем, что инвайт предназначен этому пользователю
    if (
      normalizePhoneNumber(user.phone) !== normalizePhoneNumber(invite.phone)
    ) {
      throw new ForbiddenException(
        'Этот инвайт предназначен другому пользователю'
      );
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        invite.status === InviteStatus.ACCEPTED
          ? 'Инвайт уже был принят'
          : 'Инвайт уже был отклонен'
      );
    }

    // Обновляем статус инвайта
    invite.status = InviteStatus.REJECTED;
    invite.statusChangedAt = new Date();
    invite.invitedUser = user;

    await this.invitesRepository.save(invite);
  }

  async cancelInvite(id: string): Promise<void> {
    const invite = await this.findOne(id);

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        invite.status === InviteStatus.ACCEPTED
          ? 'Инвайт уже был принят'
          : invite.status === InviteStatus.REJECTED
          ? 'Инвайт уже был отклонен'
          : 'Инвайт уже был отменен'
      );
    }

    // Обновляем статус инвайта
    invite.status = InviteStatus.CANCELLED;
    invite.statusChangedAt = new Date();

    await this.invitesRepository.save(invite);
  }

  async remove(id: string): Promise<void> {
    const invite = await this.findOne(id);
    await this.invitesRepository.remove(invite);
  }

  async findAllForAdmin(): Promise<Invite[]> {
    return this.invitesRepository.find({
      relations: ['createdBy', 'invitedUser', 'warehouse', 'shop'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getStats() {
    const [invites, total] = await this.invitesRepository.findAndCount();

    const pending = invites.filter(
      (invite) => invite.status === InviteStatus.PENDING
    ).length;
    const accepted = invites.filter(
      (invite) => invite.status === InviteStatus.ACCEPTED
    ).length;
    const rejected = invites.filter(
      (invite) => invite.status === InviteStatus.REJECTED
    ).length;
    const cancelled = invites.filter(
      (invite) => invite.status === InviteStatus.CANCELLED
    ).length;

    const byRole = {
      [RoleType.SUPERADMIN]: invites.filter(
        (invite) => invite.role === RoleType.SUPERADMIN
      ).length,
      [RoleType.OWNER]: invites.filter(
        (invite) => invite.role === RoleType.OWNER
      ).length,
      [RoleType.MANAGER]: invites.filter(
        (invite) => invite.role === RoleType.MANAGER
      ).length,
      [RoleType.CASHIER]: invites.filter(
        (invite) => invite.role === RoleType.CASHIER
      ).length,
    };

    return {
      total,
      pending,
      accepted,
      rejected,
      cancelled,
      byRole,
    };
  }
}
