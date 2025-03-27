import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { Barcode } from '../entities/barcode.entity';

@Injectable()
export class WarehouseProductsService {
  private readonly logger = new Logger(WarehouseProductsService.name);

  constructor(
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>
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

  // Метод для создания товара на складе
  async createWarehouseProduct(productDto: any): Promise<WarehouseProduct> {
    this.logger.log(
      `[createWarehouseProduct] Создание товара на складе ${productDto.warehouseId}`
    );

    try {
      // Проверяем, существует ли склад
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: productDto.warehouseId },
      });

      if (!warehouse) {
        this.logger.error(
          `[createWarehouseProduct] Склад ${productDto.warehouseId} не найден`
        );
        throw new NotFoundException(
          `Склад ${productDto.warehouseId} не найден`
        );
      }

      // Проверяем, существует ли штрихкод
      let barcode;
      if (productDto.barcodeId) {
        barcode = await this.barcodeRepository.findOne({
          where: { id: productDto.barcodeId },
        });
      } else if (productDto.barcode) {
        // Проверяем формат barcode - может быть объектом или строкой
        if (typeof productDto.barcode === 'string') {
          // Если barcode - строка, создаем новый штрихкод с этим кодом
          this.logger.debug(
            `[createWarehouseProduct] Создаем новый штрихкод из строки: ${productDto.barcode}`
          );

          const newBarcode = this.barcodeRepository.create({
            code: productDto.barcode, // Используем строку как код
            productName: productDto.name || 'Новый товар', // Используем имя из запроса или значение по умолчанию
            description: productDto.description || '',
            categoryId: productDto.categoryId,
            isService: false,
            isActive: true,
            shopId: warehouse.shopId,
          });
          barcode = await this.barcodeRepository.save(newBarcode);
        } else {
          // Если передан объект штрихкода, создаем новый
          this.logger.debug(
            `[createWarehouseProduct] Создаем новый штрихкод из объекта`
          );

          const newBarcode = this.barcodeRepository.create({
            code: productDto.barcode.code,
            productName: productDto.barcode.productName,
            description: productDto.barcode.description,
            categoryId: productDto.barcode.categoryId,
            isService: false,
            isActive: true,
            shopId: warehouse.shopId, // Используем shopId склада
          });
          barcode = await this.barcodeRepository.save(newBarcode);
        }

        this.logger.debug(
          `[createWarehouseProduct] Создан новый штрихкод: ${barcode.id}`
        );
      } else {
        this.logger.error(
          `[createWarehouseProduct] Не указан штрихкод для товара`
        );
        throw new Error('Не указан штрихкод для товара');
      }

      // Создаем товар склада с правильными полями в соответствии с сущностью
      const warehouseProduct = new WarehouseProduct();
      warehouseProduct.warehouseId = warehouse.id;
      warehouseProduct.barcodeId = barcode.id;
      warehouseProduct.quantity = productDto.quantity || 0;
      warehouseProduct.purchasePrice = productDto.purchasePrice || 0;
      warehouseProduct.sellingPrice = productDto.sellingPrice || 0;
      warehouseProduct.minQuantity = productDto.minQuantity || 0;
      warehouseProduct.isActive = true;

      // Сохраняем товар склада
      const savedProduct =
        await this.warehouseProductRepository.save(warehouseProduct);
      this.logger.log(
        `[createWarehouseProduct] Товар успешно создан: ${savedProduct.id}`
      );

      return savedProduct;
    } catch (error) {
      this.logger.error(
        `[createWarehouseProduct] Ошибка при создании товара: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
