import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { Barcode } from '../entities/barcode.entity';
import { CreateServiceProductDto } from '../dto/warehouse-products/create-service-product.dto';

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

    const whereCondition: any = {
      warehouseId: In(warehouseIds),
      isActive: true,
    };

    // Добавляем фильтр по isService, если он указан
    if (isService !== undefined) {
      this.logger.debug(
        `[getWarehouseProductsByShop] Применяем фильтр isService=${isService}`
      );
      whereCondition.barcode = { isService };
    }

    const products = await this.warehouseProductRepository.find({
      where: whereCondition,
      relations: ['barcode', 'warehouse', 'barcode.category'],
      select: {
        id: true,
        quantity: true,
        minQuantity: true,
        isActive: true,
        warehouseId: true,
        barcode: {
          id: true,
          productName: true,
          isService: true,
        },
      },
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
        whereCondition.barcode = { isService };
      }

      this.logger.debug(
        `[getWarehouseProductsByWarehouseId] Запрос товаров с условием: ${JSON.stringify(
          whereCondition
        )}`
      );
      const products = await this.warehouseProductRepository.find({
        where: whereCondition,
        relations: ['barcode', 'warehouse', 'barcode.category'],
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

      // Проверяем, есть ли баркод у товара
      let barcode;
      let barcodeId;

      if (productDto.barcodeId) {
        this.logger.debug(
          `[createWarehouseProduct] Ищем баркод по ID ${productDto.barcodeId}`
        );
        barcode = await this.barcodeRepository.findOne({
          where: { id: productDto.barcodeId },
        });
        if (barcode) {
          this.logger.debug(
            `[createWarehouseProduct] Найден баркод: ${barcode.productName}`
          );
          barcodeId = barcode.id;
        }
      } else if (productDto.barcode) {
        this.logger.debug(`[createWarehouseProduct] Создаем новый баркод`);

        // Проверяем имя продукта
        const productName = productDto.name || 'Новый товар';
        this.logger.debug(
          `[createWarehouseProduct] Имя продукта: ${productName}`
        );

        // Создаем новый баркод, НЕ привязывая его к конкретному магазину
        // Баркоды теперь общие для всех магазинов
        if (typeof productDto.barcode === 'string') {
          this.logger.debug(
            `[createWarehouseProduct] Создаем баркод из строки: ${productDto.barcode}`
          );
          // Если barcode - это строка, создаем новый баркод с этим кодом
          const newBarcode = this.barcodeRepository.create({
            code: productDto.barcode,
            productName: productName,
            description: productDto.description || '',
            categoryId: productDto.categoryId,
            isService: false,
            isActive: true,
            // Не указываем shopId, чтобы баркод был доступен всем
          });

          barcode = await this.barcodeRepository.save(newBarcode);
          barcodeId = barcode.id;
        } else {
          // Если barcode - это объект, используем его свойства
          this.logger.debug(
            `[createWarehouseProduct] Создаем баркод из объекта`
          );
          const newBarcode = this.barcodeRepository.create({
            ...productDto.barcode,
            productName: productName,
            description:
              productDto.description || productDto.barcode.description || '',
            isActive: true,
            // Не указываем shopId, чтобы баркод был доступен всем
          });

          barcode = await this.barcodeRepository.save(newBarcode);
          barcodeId = barcode.id;
        }
      } else {
        this.logger.error(
          `[createWarehouseProduct] Не указан баркод для товара`
        );
        throw new Error('Необходимо указать баркод (barcodeId или barcode)');
      }

      // Создаем товар склада с правильными полями в соответствии с сущностью
      const warehouseProduct = new WarehouseProduct();
      warehouseProduct.warehouseId = warehouse.id;
      warehouseProduct.barcodeId = barcodeId;
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

  // Метод для получения товара по ID
  async getWarehouseProductById(id: string): Promise<WarehouseProduct> {
    this.logger.log(`[getWarehouseProductById] Получение товара с ID ${id}`);

    try {
      const product = await this.warehouseProductRepository.findOne({
        where: { id },
        relations: ['barcode', 'warehouse'],
      });

      if (!product) {
        this.logger.error(
          `[getWarehouseProductById] Товар с ID ${id} не найден`
        );
        throw new NotFoundException(`Товар с ID ${id} не найден`);
      }

      this.logger.debug(
        `[getWarehouseProductById] Товар найден: ${JSON.stringify({
          id: product.id,
          barcode: product.barcode
            ? {
                id: product.barcode.id,
                productName: product.barcode.productName,
              }
            : null,
        })}`
      );

      return product;
    } catch (error) {
      this.logger.error(
        `[getWarehouseProductById] Ошибка при получении товара: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  // Метод для обновления товара на складе
  async updateWarehouseProduct(
    id: string,
    updateDto: Partial<WarehouseProduct>
  ): Promise<WarehouseProduct> {
    this.logger.log(`[updateWarehouseProduct] Обновление товара с ID ${id}`);

    try {
      const product = await this.warehouseProductRepository.findOne({
        where: { id, isActive: true },
        relations: ['barcode', 'warehouse'],
      });

      if (!product) {
        this.logger.error(
          `[updateWarehouseProduct] Товар с ID ${id} не найден`
        );
        throw new NotFoundException(`Товар с ID ${id} не найден`);
      }

      // Обновляем только разрешенные поля
      if (updateDto.purchasePrice !== undefined) {
        product.purchasePrice = updateDto.purchasePrice;
      }
      if (updateDto.sellingPrice !== undefined) {
        product.sellingPrice = updateDto.sellingPrice;
      }
      if (updateDto.quantity !== undefined) {
        product.quantity = updateDto.quantity;
      }
      if (updateDto.minQuantity !== undefined) {
        product.minQuantity = updateDto.minQuantity;
      }
      if (updateDto.isActive !== undefined) {
        product.isActive = updateDto.isActive;
      }

      const updatedProduct =
        await this.warehouseProductRepository.save(product);
      this.logger.log(
        `[updateWarehouseProduct] Товар успешно обновлен: ${updatedProduct.id}`
      );

      return updatedProduct;
    } catch (error) {
      this.logger.error(
        `[updateWarehouseProduct] Ошибка при обновлении товара: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async createServiceProduct(
    dto: CreateServiceProductDto,
    userId: string
  ): Promise<WarehouseProduct> {
    const barcode = await this.barcodeRepository.findOne({
      where: { id: dto.barcodeId },
      relations: ['shop'],
    });

    if (!barcode) {
      throw new NotFoundException('Barcode not found');
    }

    if (!barcode.isService) {
      throw new BadRequestException('Barcode is not a service');
    }

    const warehouse = await this.warehouseRepository.findOne({
      where: { id: dto.warehouseId },
      relations: ['shop'],
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    if (warehouse.shop.id !== barcode.shop.id) {
      throw new BadRequestException(
        'Barcode and warehouse must belong to the same shop'
      );
    }

    const existingProduct = await this.warehouseProductRepository.findOne({
      where: {
        barcode: { id: dto.barcodeId },
        warehouse: { id: dto.warehouseId },
      },
    });

    if (existingProduct) {
      if (!existingProduct.isActive) {
        // Если услуга существует, но неактивна - активируем её
        existingProduct.isActive = true;
        existingProduct.sellingPrice =
          dto.sellingPrice || existingProduct.sellingPrice;
        existingProduct.purchasePrice =
          dto.purchasePrice || existingProduct.purchasePrice;
        return this.warehouseProductRepository.save(existingProduct);
      }
      throw new BadRequestException(
        'Service product already exists in this warehouse'
      );
    }

    const product = this.warehouseProductRepository.create({
      barcode,
      warehouse,
      isService: true,
      sellingPrice: dto.sellingPrice || 0,
      purchasePrice: dto.purchasePrice || 0,
      quantity: 0,
      minQuantity: 0,
    });

    return this.warehouseProductRepository.save(product);
  }

  async findOne(id: string): Promise<WarehouseProduct | null> {
    return this.warehouseProductRepository.findOne({
      where: { id },
      relations: ['barcode', 'warehouse'],
    });
  }

  async update(
    id: string,
    updateDto: Partial<WarehouseProduct>
  ): Promise<WarehouseProduct> {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Товар с ID ${id} не найден`);
    }

    Object.assign(product, updateDto);
    return this.warehouseProductRepository.save(product);
  }
}
