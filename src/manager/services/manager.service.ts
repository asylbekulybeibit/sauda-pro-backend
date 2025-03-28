import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { Barcode } from '../entities/barcode.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class ManagerService {
  private readonly logger = new Logger(ManagerService.name);

  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера');
    }
  }

  async validateManagerAccessToShop(
    userId: string,
    shopId: string
  ): Promise<void> {
    // Проверяем, что пользователь является менеджером
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      this.logger.error(
        `[validateManagerAccessToShop] Роль менеджера не найдена для userId=${userId}`
      );
      throw new ForbiddenException('У вас нет прав менеджера склада');
    }

    this.logger.log(
      `[validateManagerAccessToShop] Доступ подтвержден для userId=${userId}, запрошенный shopId=${shopId}`
    );
  }

  async getWarehouse(warehouseId: string, userId: string): Promise<Warehouse> {
    await this.validateManagerAccess(userId, warehouseId);

    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundException('Склад не найден');
    }

    return warehouse;
  }

  async getDashboard(userId: string) {
    // Получаем склад, где пользователь является менеджером
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId: userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера');
    }

    if (!managerRole.warehouse) {
      throw new NotFoundException('У менеджера нет привязки к складу');
    }

    // Базовая информация для дашборда, только о складе
    return {
      warehouse: managerRole.warehouse,
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

  async getWarehousesByShop(shopId: string, userId: string) {
    await this.validateManagerAccessToShop(userId, shopId);

    return this.warehouseRepository.find({
      where: { shopId, isActive: true },
      order: { isMain: 'DESC', name: 'ASC' },
    });
  }

  async getBarcodes(
    shopId: string,
    userId: string,
    isService: boolean = false
  ) {
    // Проверяем, что пользователь является менеджером
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      this.logger.error(
        `[getBarcodes] Роль менеджера не найдена для userId=${userId}`
      );
      throw new ForbiddenException('У вас нет прав менеджера склада');
    }

    this.logger.log(
      `[getBarcodes] Получение баркодов для магазина ${shopId}, isService=${isService}`
    );

    // Получаем баркоды только для указанного магазина
    return this.barcodeRepository.find({
      where: {
        shopId,
        isService,
        isActive: true,
      },
      relations: ['category'],
      order: { productName: 'ASC' },
    });
  }
}
