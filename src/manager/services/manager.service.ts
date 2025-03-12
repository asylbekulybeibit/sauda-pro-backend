import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { UserRole } from '../../roles/entities/user-role.entity';

@Injectable()
export class ManagerService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  async getDashboard(userId: string) {
    // Получаем магазин, где пользователь является менеджером
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId: userId,
        role: 'manager',
        isActive: true,
      },
      relations: ['shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера');
    }

    // Базовая информация для дашборда
    return {
      shop: managerRole.shop,
      stats: {
        // TODO: Добавить статистику
        products: {
          total: 0,
          lowStock: 0,
        },
        sales: {
          today: 0,
          week: 0,
          month: 0,
        },
        staff: {
          total: 0,
          active: 0,
        },
      },
    };
  }
}
