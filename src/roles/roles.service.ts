import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, RoleType } from './entities/user-role.entity';
import { CreateUserRoleDto } from './dto/create-user-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  async create(createUserRoleDto: CreateUserRoleDto): Promise<UserRole> {
    // Проверяем, нет ли уже активной роли у пользователя в этом магазине
    const existingRole = await this.userRoleRepository.findOne({
      where: {
        userId: createUserRoleDto.userId,
        shopId: createUserRoleDto.shopId,
        role: createUserRoleDto.role,
        isActive: true,
      },
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
      relations: ['user', 'shop'],
    });
  }

  async findOne(id: string): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id },
      relations: ['user', 'shop'],
    });

    if (!userRole) {
      throw new NotFoundException(`Роль с ID ${id} не найдена`);
    }

    return userRole;
  }

  async findByUser(userId: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: { userId },
      relations: ['shop'],
    });
  }

  async findByUserAndShop(userId: string, shopId: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: { userId, shopId },
      relations: ['shop'],
    });
  }

  async remove(id: string): Promise<void> {
    const userRole = await this.findOne(id);
    await this.userRoleRepository.remove(userRole);
  }

  async hasRole(
    userId: string,
    shopId: string,
    roles: RoleType[]
  ): Promise<boolean> {
    const userRoles = await this.findByUserAndShop(userId, shopId);
    return userRoles.some((userRole) => roles.includes(userRole.role));
  }
}
