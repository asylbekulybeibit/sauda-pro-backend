import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  async validateManagerAccess(userId: string, shopId: string): Promise<void> {
    // Проверяем роль менеджера магазина
    const shopManagerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (shopManagerRole) {
      return; // У пользователя есть прямой доступ к магазину
    }

    // Если нет прямой роли для магазина, ищем роль менеджера склада в этом магазине
    const warehouseManagerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['warehouse'],
    });

    if (
      warehouseManagerRole &&
      warehouseManagerRole.warehouse &&
      warehouseManagerRole.warehouse.shopId === shopId
    ) {
      return; // У пользователя есть доступ к складу этого магазина
    }

    throw new ForbiddenException(
      'У вас нет прав для управления этим магазином'
    );
  }

  async create(
    userId: string,
    createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, createSupplierDto.shopId);

    this.logger.log(
      `[create] Создание поставщика ${createSupplierDto.name} для магазина ${createSupplierDto.shopId}`
    );

    // Создаем поставщика с привязкой только к магазину
    const supplier = this.suppliersRepository.create({
      ...createSupplierDto,
      isActive: true,
    });

    return this.suppliersRepository.save(supplier);
  }

  async findAll(userId: string, shopId: string): Promise<Supplier[]> {
    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    this.logger.log(
      `[findAll] Получение всех поставщиков для магазина ${shopId}`
    );

    // Получаем всех поставщиков магазина
    return this.suppliersRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(userId: string, shopId: string, id: string): Promise<Supplier> {
    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.suppliersRepository.findOne({
      where: { id, shopId },
    });

    if (!supplier) {
      throw new NotFoundException('Поставщик не найден');
    }

    return supplier;
  }

  async update(
    userId: string,
    shopId: string,
    id: string,
    updateData: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.findOne(userId, shopId, id);

    // Обновляем данные поставщика
    Object.assign(supplier, updateData);

    return this.suppliersRepository.save(supplier);
  }

  async remove(userId: string, shopId: string, id: string): Promise<void> {
    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.findOne(userId, shopId, id);

    // Помечаем поставщика как неактивного вместо удаления
    supplier.isActive = false;
    await this.suppliersRepository.save(supplier);
  }
}
