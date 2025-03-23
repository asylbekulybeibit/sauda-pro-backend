import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from '../dto/vehicles/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/vehicles/update-vehicle.dto';
import { Vehicle } from '../entities/vehicle.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { Client } from '../entities/client.entity';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
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

  private async validateClient(clientId: string, shopId: string) {
    const client = await this.clientRepository.findOne({
      where: { id: clientId, shopId },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден в данном магазине');
    }

    return client;
  }

  async create(
    createVehicleDto: CreateVehicleDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);
    await this.validateClient(createVehicleDto.clientId, shopId);

    const vehicle = this.vehicleRepository.create({
      ...createVehicleDto,
      shopId,
    });

    return this.vehicleRepository.save(vehicle);
  }

  async findAll(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.vehicleRepository.find({
      where: { shopId },
      relations: ['client'],
      order: { make: 'ASC', model: 'ASC' },
    });
  }

  async findByClient(clientId: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.vehicleRepository.find({
      where: { clientId, shopId },
      order: { make: 'ASC', model: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const vehicle = await this.vehicleRepository.findOne({
      where: { id, shopId },
      relations: ['client'],
    });

    if (!vehicle) {
      throw new NotFoundException('Автомобиль не найден');
    }

    return vehicle;
  }

  async update(
    id: string,
    updateVehicleDto: UpdateVehicleDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const vehicle = await this.findOne(id, userId, shopId);

    // Если клиент меняется, проверяем его существование
    if (
      updateVehicleDto.clientId &&
      updateVehicleDto.clientId !== vehicle.clientId
    ) {
      await this.validateClient(updateVehicleDto.clientId, shopId);
    }

    // Обновляем только те поля, которые переданы в DTO
    Object.assign(vehicle, updateVehicleDto);

    return this.vehicleRepository.save(vehicle);
  }

  async remove(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const vehicle = await this.findOne(id, userId, shopId);

    // Мягкое удаление - в данной сущности пока нет поля isActive
    // поэтому будет удалять физически
    return this.vehicleRepository.remove(vehicle);
  }
}
