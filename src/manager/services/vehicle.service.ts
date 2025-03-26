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

    // Проверка клиента, если указан
    if (createVehicleDto.clientId) {
      await this.validateClient(createVehicleDto.clientId, shopId);
    }

    // Проверка на уникальность техпаспорта, если он указан
    if (createVehicleDto.registrationCertificate) {
      const existingVehicle = await this.vehicleRepository.findOne({
        where: {
          registrationCertificate: createVehicleDto.registrationCertificate,
        },
      });

      if (existingVehicle) {
        throw new ForbiddenException(
          'Автомобиль с таким номером техпаспорта уже существует'
        );
      }
    }

    // Создание записи
    const vehicle = this.vehicleRepository.create({
      ...createVehicleDto,
      shopId,
    });

    return await this.vehicleRepository.save(vehicle);
  }

  async findAll(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return await this.vehicleRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      relations: ['client'],
      order: { make: 'ASC', model: 'ASC' },
    });
  }

  async findByClient(userId: string, shopId: string, clientId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.vehicleRepository.find({
      where: {
        clientId,
        shopId,
        isActive: true,
      },
      order: { make: 'ASC', model: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const vehicle = await this.vehicleRepository.findOne({
      where: {
        id,
        shopId,
        isActive: true,
      },
      relations: ['client'],
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle not found`);
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

    // Находим автомобиль
    const vehicle = await this.vehicleRepository.findOne({
      where: { id, shopId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle not found`);
    }

    // Проверка клиента, если указан
    if (updateVehicleDto.clientId) {
      await this.validateClient(updateVehicleDto.clientId, shopId);
    }

    // Проверка на уникальность техпаспорта, если он изменяется
    if (
      updateVehicleDto.registrationCertificate &&
      updateVehicleDto.registrationCertificate !==
        vehicle.registrationCertificate
    ) {
      const existingVehicle = await this.vehicleRepository.findOne({
        where: {
          registrationCertificate: updateVehicleDto.registrationCertificate,
        },
      });

      if (existingVehicle && existingVehicle.id !== id) {
        throw new ForbiddenException(
          'Автомобиль с таким номером техпаспорта уже существует'
        );
      }
    }

    // Обновление записи
    await this.vehicleRepository.update(id, updateVehicleDto);

    return this.findOne(id, userId, shopId);
  }

  async remove(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const vehicle = await this.findOne(id, userId, shopId);

    // Мягкое удаление - устанавливаем isActive в false
    vehicle.isActive = false;
    return this.vehicleRepository.save(vehicle);
  }
}
