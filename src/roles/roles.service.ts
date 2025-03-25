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
    // Проверяем, нет ли уже активной роли у пользователя в этом магазине
    const whereCondition: any = {
      userId: createUserRoleDto.userId,
      shopId: createUserRoleDto.shopId,
      type: createUserRoleDto.type,
      isActive: true,
    };

    // Если указан склад, добавляем его в условие поиска
    if (createUserRoleDto.warehouseId) {
      whereCondition.warehouseId = createUserRoleDto.warehouseId;
    }

    const existingRole = await this.userRoleRepository.findOne({
      where: whereCondition,
    });

    if (existingRole) {
      throw new BadRequestException(
        'Пользователь уже имеет активную роль в этом магазине'
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
      relations: ['user', 'shop'],
    });
  }

  async findOne(id: string): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id },
      relations: ['user', 'shop'],
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
      relations: ['shop', 'warehouse'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findByUserAndShop(
    userId: string,
    shopId: string,
    warehouseId?: string
  ): Promise<UserRole[]> {
    const whereCondition: any = { userId, shopId };

    if (warehouseId) {
      whereCondition.warehouseId = warehouseId;
    }

    return this.userRoleRepository.find({
      where: whereCondition,
      relations: ['shop', 'warehouse'],
    });
  }

  async remove(id: string): Promise<void> {
    const userRole = await this.findOne(id);
    await this.userRoleRepository.remove(userRole);
  }

  async hasRole(
    userId: string,
    shopId: string,
    roles: RoleType[],
    warehouseId?: string
  ): Promise<boolean> {
    const userRoles = await this.findByUserAndShop(userId, shopId, warehouseId);
    return userRoles.some(
      (userRole) =>
        roles.includes(userRole.type) &&
        userRole.isActive &&
        (!warehouseId || userRole.warehouseId === warehouseId)
    );
  }
}
