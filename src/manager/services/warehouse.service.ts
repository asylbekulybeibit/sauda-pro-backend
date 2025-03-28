import { NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>
  ) {}

  async findOne(id: string) {
    console.log(`[WarehouseService] Поиск склада с ID: ${id}`);

    try {
      const warehouse = await this.warehouseRepository.findOne({
        where: { id },
        relations: ['shop'],
      });

      console.log('[WarehouseService] Результат поиска:', warehouse);

      if (!warehouse) {
        console.log(`[WarehouseService] Склад с ID ${id} не найден`);
        throw new NotFoundException(`Warehouse with ID ${id} not found`);
      }

      console.log('[WarehouseService] Склад успешно найден:', {
        id: warehouse.id,
        name: warehouse.name,
        shopId: warehouse.shopId,
      });

      return warehouse;
    } catch (error) {
      console.error('[WarehouseService] Ошибка при поиске склада:', error);
      throw error;
    }
  }
}
