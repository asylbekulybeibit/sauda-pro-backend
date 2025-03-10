import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from './entities/invite.entity';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RoleType } from '../roles/entities/user-role.entity';
import { normalizePhoneNumber } from '../common/utils/phone.util';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    @InjectRepository(Invite)
    private invitesRepository: Repository<Invite>,
    private usersService: UsersService,
    private rolesService: RolesService
  ) {}

  async create(createInviteDto: CreateInviteDto, createdById: string) {
    const creator = await this.usersService.findOne(createdById);
    const normalizedPhone = normalizePhoneNumber(createInviteDto.phone);

    // Проверяем, нет ли уже активного инвайта для этого номера
    const existingInvite = await this.invitesRepository.findOne({
      where: {
        phone: normalizedPhone,
        isAccepted: false,
      },
    });

    if (existingInvite) {
      throw new BadRequestException(
        'Активный инвайт для этого номера уже существует'
      );
    }

    const invite = this.invitesRepository.create({
      phone: normalizedPhone,
      role: createInviteDto.role,
      shopId: createInviteDto.shopId,
      createdById: creator.id,
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
      where: { phone: normalizedPhone, isAccepted: false },
      relations: ['createdBy', 'shop'],
    });
  }

  async findPendingInvitesByPhone(phone: string): Promise<Invite[]> {
    const normalizedPhone = normalizePhoneNumber(phone);
    return this.invitesRepository.find({
      where: {
        phone: normalizedPhone,
        isAccepted: false,
      },
      relations: ['createdBy', 'shop'],
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

    if (invite.isAccepted) {
      throw new BadRequestException('Инвайт уже был принят');
    }

    // Создаем новую роль для пользователя
    await this.rolesService.create({
      userId: user.id,
      shopId: invite.shopId,
      role: invite.role,
    });

    // Обновляем статус инвайта
    invite.isAccepted = true;
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

    if (invite.isAccepted) {
      throw new BadRequestException('Инвайт уже был принят');
    }

    await this.invitesRepository.remove(invite);
  }
}
