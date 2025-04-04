import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../roles/entities/user-role.entity';
import { RoleType } from '../auth/types/role.type';

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
      relations: ['roles', 'roles.shop', 'roles.warehouse'],
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
      relations: ['roles', 'roles.shop', 'roles.warehouse'],
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
          type: r.type,
          isActive: r.isActive,
          warehouseId: r.warehouse?.id,
        })),
      }))
    );

    const activeUsers = users.filter((user) => user.isActive);
    this.logger.debug(`Активных пользователей: ${activeUsers.length}`);

    const active = activeUsers.length;
    const superadmins = activeUsers.filter((user) => user.isSuperAdmin).length;
    this.logger.debug(`Суперадминов среди активных: ${superadmins}`);

    // Подсчитываем все роли, включая дубликаты в разных складах
    const byRole = {
      [RoleType.OWNER]: activeUsers.reduce(
        (count, user) =>
          count +
          user.roles.filter((role) => role.type === RoleType.OWNER).length,
        0
      ),
      [RoleType.MANAGER]: activeUsers.reduce(
        (count, user) =>
          count +
          user.roles.filter((role) => role.type === RoleType.MANAGER).length,
        0
      ),
      [RoleType.CASHIER]: activeUsers.reduce(
        (count, user) =>
          count +
          user.roles.filter((role) => role.type === RoleType.CASHIER).length,
        0
      ),
    };

    this.logger.debug(
      'Распределение по ролям (с учетом всех складов):',
      byRole
    );
    this.logger.debug(
      'Детальная разбивка ролей по пользователям:',
      activeUsers.map((user) => ({
        userId: user.id,
        roles: user.roles.map((r) => ({
          type: r.type,
          warehouseId: r.warehouse?.id,
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
