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

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    this.logger.debug(
      `[validateManagerAccess] Проверка доступа для userId: ${userId}, shopId: ${shopId}`
    );

    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      this.logger.warn(
        `[validateManagerAccess] Доступ запрещен для userId: ${userId}, shopId: ${shopId}`
      );
      throw new ForbiddenException('Нет доступа к этому магазину');
    }

    this.logger.debug(
      `[validateManagerAccess] Доступ подтвержден для userId: ${userId}, shopId: ${shopId}`
    );
  }

  async create(
    userId: string,
    createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    this.logger.log(
      `[create] Начало создания поставщика для магазина ${createSupplierDto.shopId}`
    );
    this.logger.debug(`[create] Данные поставщика:`, createSupplierDto);

    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, createSupplierDto.shopId);

    // Создаем поставщика с привязкой только к магазину
    const supplier = this.suppliersRepository.create({
      ...createSupplierDto,
      isActive: true,
    });

    const savedSupplier = await this.suppliersRepository.save(supplier);
    this.logger.log(
      `[create] Поставщик успешно создан с ID: ${savedSupplier.id}`
    );
    this.logger.debug(`[create] Созданный поставщик:`, savedSupplier);

    return savedSupplier;
  }

  async findAll(userId: string, shopId: string): Promise<Supplier[]> {
    this.logger.log(
      `[findAll] Запрос списка поставщиков для магазина ${shopId}`
    );

    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    // Получаем всех поставщиков магазина
    const suppliers = await this.suppliersRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      order: {
        name: 'ASC',
      },
    });

    this.logger.log(
      `[findAll] Найдено ${suppliers.length} поставщиков для магазина ${shopId}`
    );
    this.logger.debug(
      `[findAll] Список ID найденных поставщиков:`,
      suppliers.map((s) => s.id)
    );

    return suppliers;
  }

  async findOne(userId: string, shopId: string, id: string): Promise<Supplier> {
    this.logger.log(`[findOne] Поиск поставщика ${id} для магазина ${shopId}`);

    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.suppliersRepository.findOne({
      where: { id, shopId },
    });

    if (!supplier) {
      this.logger.warn(
        `[findOne] Поставщик ${id} не найден в магазине ${shopId}`
      );
      throw new NotFoundException('Поставщик не найден');
    }

    this.logger.debug(`[findOne] Найден поставщик:`, supplier);
    return supplier;
  }

  async update(
    userId: string,
    shopId: string,
    id: string,
    updateData: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    this.logger.log(
      `[update] Обновление поставщика ${id} в магазине ${shopId}`
    );
    this.logger.debug(`[update] Данные для обновления:`, updateData);

    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.findOne(userId, shopId, id);

    // Обновляем данные поставщика
    Object.assign(supplier, updateData);

    const updatedSupplier = await this.suppliersRepository.save(supplier);
    this.logger.log(`[update] Поставщик ${id} успешно обновлен`);
    this.logger.debug(`[update] Обновленный поставщик:`, updatedSupplier);

    return updatedSupplier;
  }

  async remove(userId: string, shopId: string, id: string): Promise<void> {
    this.logger.log(
      `[remove] Деактивация поставщика ${id} в магазине ${shopId}`
    );

    // Проверяем доступ к магазину
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.findOne(userId, shopId, id);

    // Помечаем поставщика как неактивного вместо удаления
    supplier.isActive = false;
    await this.suppliersRepository.save(supplier);

    this.logger.log(`[remove] Поставщик ${id} успешно деактивирован`);
  }
}
