import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RoleType } from '../roles/entities/user-role.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['roles', 'roles.shop'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.shop'],
      order: {
        roles: {
          createdAt: 'DESC',
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { phone },
      relations: ['roles', 'roles.shop'],
      order: {
        roles: {
          createdAt: 'DESC',
        },
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async getStats() {
    this.logger.debug('Начинаем подсчет статистики пользователей');

    const [users, total] = await this.usersRepository.findAndCount({
      relations: {
        roles: {
          shop: true,
        },
      },
      where: {
        roles: {
          isActive: true,
        },
      },
    });

    this.logger.debug(`Всего пользователей в базе: ${total}`);
    this.logger.debug(
      'Пользователи:',
      users.map((u) => ({
        id: u.id,
        isActive: u.isActive,
        isSuperAdmin: u.isSuperAdmin,
        roles: u.roles.map((r) => ({
          role: r.role,
          isActive: r.isActive,
          shopId: r.shop?.id,
        })),
      }))
    );

    const activeUsers = users.filter((user) => user.isActive);
    this.logger.debug(`Активных пользователей: ${activeUsers.length}`);

    const active = activeUsers.length;
    const superadmins = activeUsers.filter((user) => user.isSuperAdmin).length;
    this.logger.debug(`Суперадминов среди активных: ${superadmins}`);

    // Подсчитываем все роли, включая дубликаты в разных магазинах
    const byRole = {
      [RoleType.OWNER]: activeUsers.reduce(
        (count, user) =>
          count +
          user.roles.filter((role) => role.role === RoleType.OWNER).length,
        0
      ),
      [RoleType.MANAGER]: activeUsers.reduce(
        (count, user) =>
          count +
          user.roles.filter((role) => role.role === RoleType.MANAGER).length,
        0
      ),
      [RoleType.CASHIER]: activeUsers.reduce(
        (count, user) =>
          count +
          user.roles.filter((role) => role.role === RoleType.CASHIER).length,
        0
      ),
    };

    this.logger.debug(
      'Распределение по ролям (с учетом всех магазинов):',
      byRole
    );
    this.logger.debug(
      'Детальная разбивка ролей по пользователям:',
      activeUsers.map((user) => ({
        userId: user.id,
        roles: user.roles.map((r) => ({
          role: r.role,
          shopId: r.shop?.id,
        })),
      }))
    );

    // Получаем количество пользователей за последний месяц
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [lastMonthUsers] = await this.usersRepository.findAndCount({
      where: { createdAt: MoreThan(lastMonth) },
    });

    const growth =
      lastMonthUsers.length > 0
        ? Math.round((lastMonthUsers.length / total) * 100)
        : 0;

    this.logger.debug(`Рост за последний месяц: ${growth}%`);

    const stats = {
      total,
      active,
      superadmins,
      byRole,
      growth,
    };

    this.logger.debug('Итоговая статистика:', stats);
    return stats;
  }
}
