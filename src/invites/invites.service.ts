import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from './entities/invite.entity';
import { UsersService } from '../users/users.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RoleType } from '../roles/entities/user-role.entity';
import { normalizePhoneNumber } from '../common/utils/phone.util';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    @InjectRepository(Invite)
    private invitesRepository: Repository<Invite>,
    private usersService: UsersService
  ) {}

  async create(
    createInviteDto: CreateInviteDto,
    createdById: string
  ): Promise<Invite> {
    // Проверяем существование пользователя, создающего инвайт
    const creator = await this.usersService.findOne(createdById);

    // Нормализуем номер телефона
    const normalizedPhone = normalizePhoneNumber(createInviteDto.phone);

    // Проверяем, есть ли уже активный инвайт для этого номера телефона
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

    // Создаем новый инвайт с нормализованным номером
    const invite = this.invitesRepository.create({
      ...createInviteDto,
      phone: normalizedPhone,
      createdById: creator.id,
    });

    await this.invitesRepository.save(invite);

    // TODO: Здесь будет интеграция с WhatsApp для отправки уведомления
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

  async acceptInvite(id: string, userId: string): Promise<Invite> {
    const invite = await this.findOne(id);
    const user = await this.usersService.findOne(userId);

    if (invite.isAccepted) {
      throw new BadRequestException('Инвайт уже был принят');
    }

    invite.isAccepted = true;
    invite.invitedUser = user;

    return this.invitesRepository.save(invite);
  }
}
