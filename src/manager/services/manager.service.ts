import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class ManagerService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера');
    }
  }

  async getShop(shopId: string, userId: string): Promise<Shop> {
    await this.validateManagerAccess(userId, shopId);

    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException('Магазин не найден');
    }

    return shop;
  }

  async getDashboard(userId: string) {
    // Получаем магазин, где пользователь является менеджером
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId: userId,
        type: RoleType.MANAGER,
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
