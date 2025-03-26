import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Warehouse } from '../entities/warehouse.entity';

@Injectable()
export class WarehouseProductsService {
  private readonly logger = new Logger(WarehouseProductsService.name);

  constructor(
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>
  ) {}

  async getWarehouseProductsByShop(
    shopId: string,
    isService?: boolean
  ): Promise<WarehouseProduct[]> {
    this.logger.log(
      `[getWarehouseProductsByShop] Получение товаров складов для магазина ${shopId}`
    );

    // Получаем все склады магазина
    this.logger.debug(
      `[getWarehouseProductsByShop] Запрос складов для магазина ${shopId}`
    );
    const warehouses = await this.warehouseRepository.find({
      where: { shopId, isActive: true },
    });
    this.logger.debug(
      `[getWarehouseProductsByShop] Найдено ${
        warehouses.length
      } складов: ${JSON.stringify(warehouses.map((w) => w.id))}`
    );

    if (!warehouses || warehouses.length === 0) {
      this.logger.warn(
        `[getWarehouseProductsByShop] Не найдены активные склады для магазина ${shopId}`
      );
      throw new NotFoundException(
        `Не найдены активные склады для магазина ${shopId}`
      );
    }

    const warehouseIds = warehouses.map((warehouse) => warehouse.id);
    this.logger.debug(
      `[getWarehouseProductsByShop] IDs складов: ${warehouseIds.join(', ')}`
    );

    // Запрашиваем все товары на складах магазина
    this.logger.debug(
      `[getWarehouseProductsByShop] Запрос товаров для складов: ${warehouseIds.join(
        ', '
      )}`
    );
    const products = await this.warehouseProductRepository.find({
      where: {
        warehouseId: In(warehouseIds),
        isActive: true,
      },
      relations: ['barcode', 'warehouse'],
      order: {
        createdAt: 'DESC',
      },
    });
    this.logger.debug(
      `[getWarehouseProductsByShop] Найдено ${products.length} товаров`
    );

    return products;
  }

  async getWarehouseProductsByWarehouseId(
    warehouseId: string,
    isService?: boolean
  ): Promise<WarehouseProduct[]> {
    this.logger.log(
      `[getWarehouseProductsByWarehouseId] Получение товаров для склада ${warehouseId}, isService=${isService}`
    );

    try {
      // Проверяем, существует ли склад
      this.logger.debug(
        `[getWarehouseProductsByWarehouseId] Проверка существования склада ${warehouseId}`
      );
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: warehouseId, isActive: true },
      });

      if (!warehouse) {
        this.logger.warn(
          `[getWarehouseProductsByWarehouseId] Не найден активный склад с ID ${warehouseId}`
        );
        throw new NotFoundException(
          `Не найден активный склад с ID ${warehouseId}`
        );
      }

      this.logger.debug(
        `[getWarehouseProductsByWarehouseId] Склад найден: ${JSON.stringify(
          warehouse
        )}`
      );

      // Запрашиваем товары только этого склада
      const whereCondition: any = {
        warehouseId,
        isActive: true,
      };

      // Добавляем фильтр по isService, если он указан
      if (isService !== undefined) {
        this.logger.debug(
          `[getWarehouseProductsByWarehouseId] Применяем фильтр isService=${isService}`
        );
        // TODO: определить, как точно применять фильтр isService
      }

      this.logger.debug(
        `[getWarehouseProductsByWarehouseId] Запрос товаров с условием: ${JSON.stringify(
          whereCondition
        )}`
      );
      const products = await this.warehouseProductRepository.find({
        where: whereCondition,
        relations: ['barcode', 'warehouse'],
        order: {
          createdAt: 'DESC',
        },
      });

      this.logger.log(
        `[getWarehouseProductsByWarehouseId] Найдено ${products.length} товаров для склада ${warehouseId}`
      );

      // Логируем первые несколько продуктов для диагностики
      if (products.length > 0) {
        this.logger.debug(
          `[getWarehouseProductsByWarehouseId] Примеры товаров: ${JSON.stringify(
            products.slice(0, 2).map((p) => ({
              id: p.id,
              warehouseId: p.warehouseId,
              barcode: p.barcode
                ? { id: p.barcode.id, productName: p.barcode.productName }
                : null,
            }))
          )}`
        );
      }

      return products;
    } catch (error) {
      this.logger.error(
        `[getWarehouseProductsByWarehouseId] Ошибка при получении товаров: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
