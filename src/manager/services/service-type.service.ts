import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServiceTypeDto } from '../dto/service-types/create-service-type.dto';
import { UpdateServiceTypeDto } from '../dto/service-types/update-service-type.dto';
import { ServiceType } from '../entities/service-type.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class ServiceTypeService {
  constructor(
    @InjectRepository(ServiceType)
    private readonly serviceTypeRepository: Repository<ServiceType>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(userId: string, shopId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    return managerRole;
  }

  async create(
    createServiceTypeDto: CreateServiceTypeDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const serviceType = this.serviceTypeRepository.create({
      ...createServiceTypeDto,
      shopId,
    });

    return this.serviceTypeRepository.save(serviceType);
  }

  async findAll(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.serviceTypeRepository.find({
      where: { shopId },
      order: { name: 'ASC' },
    });
  }

  async findAllActive(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.serviceTypeRepository.find({
      where: { shopId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const serviceType = await this.serviceTypeRepository.findOne({
      where: { id, shopId },
    });

    if (!serviceType) {
      throw new NotFoundException('Тип услуги не найден');
    }

    return serviceType;
  }

  async update(
    id: string,
    updateServiceTypeDto: UpdateServiceTypeDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const serviceType = await this.findOne(id, userId, shopId);

    // Обновляем только те поля, которые переданы в DTO
    Object.assign(serviceType, updateServiceTypeDto);

    return this.serviceTypeRepository.save(serviceType);
  }

  async remove(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const serviceType = await this.findOne(id, userId, shopId);

    // Мягкое удаление - устанавливаем isActive в false
    serviceType.isActive = false;

    return this.serviceTypeRepository.save(serviceType);
  }
}
