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
      const existingRoles = await this.rolesService.findByUserAndShop(
        existingUser.id,
        createInviteDto.shopId
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

    const duplicateInvite = existingInvites.find(
      (invite) =>
        invite.role === createInviteDto.role &&
        invite.shopId === createInviteDto.shopId
    );

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
      shopId: createInviteDto.shopId,
      createdById: creator.id,
      status: InviteStatus.PENDING,
    });

    await this.invitesRepository.save(invite);
    this.logger.debug(`Отправка инвайта на WhatsApp: ${normalizedPhone}`);

    return invite;
  }

  async findAll(): Promise<Invite[]> {
    return this.invitesRepository.find({
      relations: ['createdBy', 'invitedUser', 'shop'],
    });
  }

  async findOne(id: string): Promise<Invite> {
    const invite = await this.invitesRepository.findOne({
      where: { id },
      relations: ['createdBy', 'invitedUser', 'shop'],
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
      relations: ['createdBy', 'shop'],
    });
  }

  async findPendingInvitesByPhone(phone: string): Promise<Invite[]> {
    const normalizedPhone = normalizePhoneNumber(phone);
    return this.invitesRepository.find({
      where: {
        phone: normalizedPhone,
        status: InviteStatus.PENDING,
      },
      relations: ['createdBy', 'shop'],
    });
  }

  async findRejectedInvites(): Promise<Invite[]> {
    return this.invitesRepository.find({
      where: {
        status: InviteStatus.REJECTED,
      },
      relations: ['createdBy', 'invitedUser', 'shop'],
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
      throw new BadRequestException(
        invite.status === InviteStatus.ACCEPTED
          ? 'Инвайт уже был принят'
          : 'Инвайт был отклонен'
      );
    }

    // Проверяем, нет ли у пользователя активной роли такого типа в этом магазине
    const existingRoles = await this.rolesService.findByUserAndShop(
      user.id,
      invite.shopId
    );

    this.logger.debug(
      `Найдены роли для пользователя при принятии инвайта: ${JSON.stringify(
        existingRoles
      )}`
    );

    // Проверяем только действительно активные роли
    const hasActiveRole = existingRoles.some(
      (role) => role.type === invite.role && role.isActive
    );

    this.logger.debug(
      `Проверка роли: invite.role=${
        invite.role
      }, hasActiveRole=${hasActiveRole}, existingRoles=${JSON.stringify(
        existingRoles.map((r) => ({
          type: r.type,
          isActive: r.isActive,
          deactivatedAt: r.deactivatedAt,
        }))
      )}`
    );

    if (hasActiveRole) {
      throw new BadRequestException(
        `У пользователя уже есть активная роль "${this.getRoleName(
          invite.role
        )}" в этом магазине`
      );
    }

    // Создаем новую роль для пользователя
    await this.rolesService.create({
      userId: user.id,
      shopId: invite.shopId,
      type: invite.role,
    });

    // Обновляем статус инвайта
    invite.status = InviteStatus.ACCEPTED;
    invite.statusChangedAt = new Date();
    invite.invitedUser = user;

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
      relations: ['createdBy', 'invitedUser', 'shop'],
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
