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
import { RoleType } from '../roles/entities/user-role.entity';
import { normalizePhoneNumber } from '../common/utils/phone.util';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

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

  constructor(
    @InjectRepository(Invite)
    private invitesRepository: Repository<Invite>,
    private usersService: UsersService,
    private rolesService: RolesService
  ) {}

  async create(createInviteDto: CreateInviteDto, createdById: string) {
    const creator = await this.usersService.findOne(createdById);
    const normalizedPhone = normalizePhoneNumber(createInviteDto.phone);

    // Проверяем, существует ли пользователь с таким номером
    const existingUser = await this.usersService.findByPhone(normalizedPhone);

    if (existingUser) {
      // Проверяем, есть ли у пользователя уже такая роль в этом проекте
      const existingRoles = await this.rolesService.findByUserAndShop(
        existingUser.id,
        createInviteDto.shopId
      );

      const hasRole = existingRoles.some(
        (role) => role.role === createInviteDto.role
      );
      if (hasRole) {
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

    // Создаем новую роль для пользователя
    await this.rolesService.create({
      userId: user.id,
      shopId: invite.shopId,
      role: invite.role,
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

    const byRole = {
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
      byRole,
    };
  }
}
