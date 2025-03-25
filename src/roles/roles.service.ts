import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/user-role.entity';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { RoleType } from '../auth/types/role.type';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  async create(createUserRoleDto: CreateUserRoleDto): Promise<UserRole> {
    // Проверяем, нет ли уже активной роли у пользователя в этом складе или магазине
    const whereCondition: any = {
      userId: createUserRoleDto.userId,
      type: createUserRoleDto.type,
      isActive: true,
    };

    // Добавляем условие поиска по warehouseId только если он указан
    if (createUserRoleDto.warehouseId) {
      whereCondition.warehouseId = createUserRoleDto.warehouseId;
    }

    // Добавляем условие поиска по shopId только если он указан
    if (createUserRoleDto.shopId) {
      whereCondition.shopId = createUserRoleDto.shopId;
    }

    const existingRole = await this.userRoleRepository.findOne({
      where: whereCondition,
    });

    if (existingRole) {
      throw new BadRequestException(
        'Пользователь уже имеет активную роль в этом проекте'
      );
    }

    const userRole = this.userRoleRepository.create(createUserRoleDto);
    return this.userRoleRepository.save(userRole);
  }

  async findAll(): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: {
        type: RoleType.OWNER,
        isActive: true,
      },
      relations: ['user', 'warehouse', 'shop'],
    });
  }

  async findOne(id: string): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id },
      relations: ['user', 'warehouse', 'shop'],
    });

    if (!userRole) {
      throw new NotFoundException('User role not found');
    }

    return userRole;
  }

  async findByUser(userId: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: {
        userId,
        isActive: true,
      },
      relations: ['warehouse', 'shop'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findByUserAndWarehouse(
    userId: string,
    warehouseId?: string,
    shopId?: string
  ): Promise<UserRole[]> {
    const whereCondition: any = { userId };

    if (warehouseId) {
      whereCondition.warehouseId = warehouseId;
    }

    if (shopId) {
      whereCondition.shopId = shopId;
    }

    return this.userRoleRepository.find({
      where: whereCondition,
      relations: ['warehouse', 'shop'],
    });
  }

  async findByUserAndShop(userId: string, shopId: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: { userId, shopId },
      relations: ['warehouse', 'shop'],
    });
  }

  // Метод для поиска ролей только по shopId (без учета warehouseId)
  async findByUserAndShopOnly(
    userId: string,
    shopId: string
  ): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: { userId, shopId },
      relations: ['warehouse', 'shop'],
    });
  }

  async remove(id: string): Promise<void> {
    const userRole = await this.findOne(id);
    await this.userRoleRepository.remove(userRole);
  }

  async hasRole(
    userId: string,
    warehouseId: string | null,
    roles: RoleType[],
    shopId?: string
  ): Promise<boolean> {
    // Если указан warehouseId, проверяем по нему
    if (warehouseId) {
      const userRoles = await this.findByUserAndWarehouse(
        userId,
        warehouseId,
        shopId
      );
      return userRoles.some(
        (userRole) => roles.includes(userRole.type) && userRole.isActive
      );
    }
    // Если указан только shopId, проверяем по нему
    else if (shopId) {
      const userRoles = await this.findByUserAndShopOnly(userId, shopId);
      return userRoles.some(
        (userRole) => roles.includes(userRole.type) && userRole.isActive
      );
    }

    // Если не указаны ни warehouseId, ни shopId, возвращаем false
    return false;
  }
}
