import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateClientDto } from '../dto/clients/create-client.dto';
import { UpdateClientDto } from '../dto/clients/update-client.dto';
import { Client } from '../entities/client.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class ClientService {
  constructor(
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

  async create(
    createClientDto: CreateClientDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const client = this.clientRepository.create({
      ...createClientDto,
      shopId,
    });

    return this.clientRepository.save(client);
  }

  async findAll(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.clientRepository.find({
      where: { shopId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findAllActive(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.clientRepository.find({
      where: { shopId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const client = await this.clientRepository.findOne({
      where: { id, shopId },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    return client;
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const client = await this.findOne(id, userId, shopId);

    // Обновляем только те поля, которые переданы в DTO
    Object.assign(client, updateClientDto);

    return this.clientRepository.save(client);
  }

  async remove(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const client = await this.findOne(id, userId, shopId);

    // Мягкое удаление - устанавливаем isActive в false
    client.isActive = false;

    return this.clientRepository.save(client);
  }
}
