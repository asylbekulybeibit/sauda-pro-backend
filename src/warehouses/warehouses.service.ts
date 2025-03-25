import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Warehouse } from '../manager/entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Shop } from '../shops/entities/shop.entity';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>
  ) {}

  async create(createWarehouseDto: CreateWarehouseDto): Promise<Warehouse> {
    // Проверяем, существует ли магазин
    const shop = await this.shopRepository.findOne({
      where: { id: createWarehouseDto.shopId },
    });

    if (!shop) {
      throw new NotFoundException(
        `Магазин с ID ${createWarehouseDto.shopId} не найден`
      );
    }

    const warehouse = this.warehouseRepository.create(createWarehouseDto);
    return this.warehouseRepository.save(warehouse);
  }

  async findAll(): Promise<Warehouse[]> {
    return this.warehouseRepository.find({
      where: { isActive: true },
      relations: ['shop'],
    });
  }

  async findOne(id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
      relations: ['shop'],
    });

    if (!warehouse) {
      throw new NotFoundException(`Склад с ID ${id} не найден`);
    }

    return warehouse;
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(id);

    // Если меняется shopId, проверяем существование магазина
    if (
      updateWarehouseDto.shopId &&
      updateWarehouseDto.shopId !== warehouse.shopId
    ) {
      const shop = await this.shopRepository.findOne({
        where: { id: updateWarehouseDto.shopId },
      });

      if (!shop) {
        throw new NotFoundException(
          `Магазин с ID ${updateWarehouseDto.shopId} не найден`
        );
      }
    }

    Object.assign(warehouse, updateWarehouseDto);
    return this.warehouseRepository.save(warehouse);
  }

  async remove(id: string): Promise<void> {
    const warehouse = await this.warehouseRepository.findOne({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('Склад не найден');
    }

    await this.warehouseRepository.update(id, { isActive: false });
    this.logger.debug(`Склад ${id} деактивирован`);
  }

  async getStats() {
    const [warehouses, total] = await this.warehouseRepository.findAndCount({
      where: { isActive: true },
    });

    // Получаем количество складов за последний месяц
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [lastMonthWarehouses] = await this.warehouseRepository.findAndCount({
      where: { createdAt: MoreThan(lastMonth) },
    });

    const growth =
      lastMonthWarehouses.length > 0 && total > 0
        ? Math.round((lastMonthWarehouses.length / total) * 100)
        : 0;

    return {
      total,
      active: warehouses.length,
      growth,
    };
  }
}
