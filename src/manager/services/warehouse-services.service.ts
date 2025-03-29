import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';
import { Barcode } from '../entities/barcode.entity';
import { Service, ServiceStatus } from '../entities/service.entity';
import { CreateWarehouseServiceDto } from '../dto/warehouse-service/create-warehouse-service.dto';
// import { UpdateWarehouseServiceDto } from '../dto/warehouse-service/update-warehouse-service.dto';

@Injectable()
export class WarehouseServicesService {
  private readonly logger = new Logger(WarehouseServicesService.name);

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>
  ) {}

  private async validateAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    this.logger.debug(
      `[validateAccess] Проверка доступа пользователя ${userId} к складу ${warehouseId}`
    );

    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
      relations: ['shop'],
    });

    if (!warehouse) {
      this.logger.error(`[validateAccess] Склад с ID ${warehouseId} не найден`);
      throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
    }

    this.logger.debug(
      `[validateAccess] Склад найден: ${JSON.stringify(warehouse)}`
    );
    this.logger.log(
      `[validateAccess] Доступ подтвержден для пользователя ${userId} к складу ${warehouseId}`
    );

    // Additional access validation logic can be added here
  }

  async create(
    createWarehouseServiceDto: CreateWarehouseServiceDto,
    userId: string
  ): Promise<Service> {
    this.logger.log(
      `[create] Создание новой услуги склада, userId=${userId}, warehouseId=${createWarehouseServiceDto.warehouseId}`
    );

    await this.validateAccess(userId, createWarehouseServiceDto.warehouseId);

    // Find the warehouse to get shopId
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: createWarehouseServiceDto.warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse not found`);
    }

    // Create new service
    const service = this.serviceRepository.create({
      shopId: warehouse.shopId,
      warehouseId: createWarehouseServiceDto.warehouseId,
      barcodeId: createWarehouseServiceDto.barcodeId,
      originalPrice: createWarehouseServiceDto.price,
      finalPrice: createWarehouseServiceDto.price,
      createdBy: userId,
      status: ServiceStatus.PENDING,
      discountPercent: 0,
    });

    this.logger.debug(
      `[create] Сохранение новой услуги: ${JSON.stringify(service)}`
    );
    const result = await this.serviceRepository.save(service);
    this.logger.log(`[create] Услуга успешно создана с ID ${result.id}`);

    return result;
  }

  async findAllByShop(shopId: string, userId: string): Promise<Service[]> {
    this.logger.log(
      `[findAllByShop] Получение услуг складов для магазина ${shopId}, userId=${userId}`
    );

    // Find all warehouses associated with this shop
    this.logger.debug(`[findAllByShop] Запрос складов для магазина ${shopId}`);
    const warehouses = await this.warehouseRepository.find({
      where: { shopId, isActive: true },
    });
    this.logger.debug(
      `[findAllByShop] Найдено ${warehouses.length} складов: ${JSON.stringify(
        warehouses.map((w) => w.id)
      )}`
    );

    if (!warehouses || warehouses.length === 0) {
      this.logger.warn(
        `[findAllByShop] Не найдены активные склады для магазина ${shopId}`
      );
      throw new NotFoundException(
        `Не найдены активные склады для магазина ${shopId}`
      );
    }

    const warehouseIds = warehouses.map((warehouse) => warehouse.id);
    this.logger.debug(`[findAllByShop] ID складов: ${warehouseIds.join(', ')}`);

    // Find all services for these warehouses
    this.logger.debug(
      `[findAllByShop] Запрос услуг для складов ${warehouseIds.join(', ')}`
    );
    const services = await this.serviceRepository.find({
      where: {
        warehouseId: In(warehouseIds),
        status: ServiceStatus.PENDING,
      },
      relations: ['barcode'],
    });
    this.logger.log(`[findAllByShop] Найдено ${services.length} услуг`);

    return services;
  }

  async findByWarehouseId(warehouseId: string): Promise<Service[]> {
    this.logger.log(
      `[findByWarehouseId] Получение услуг для склада ${warehouseId}`
    );

    try {
      // Проверяем, существует ли склад
      this.logger.debug(
        `[findByWarehouseId] Проверка существования склада ${warehouseId}`
      );
      const warehouse = await this.warehouseRepository.findOne({
        where: { id: warehouseId, isActive: true },
      });

      if (!warehouse) {
        this.logger.warn(
          `[findByWarehouseId] Не найден активный склад с ID ${warehouseId}`
        );
        throw new NotFoundException(
          `Не найден активный склад с ID ${warehouseId}`
        );
      }

      this.logger.debug(
        `[findByWarehouseId] Склад найден: ${JSON.stringify(warehouse)}`
      );

      // Запрашиваем услуги только этого склада
      this.logger.debug(
        `[findByWarehouseId] Запрос услуг для склада ${warehouseId}`
      );
      const services = await this.serviceRepository.find({
        where: {
          warehouseId: warehouseId,
          status: ServiceStatus.PENDING,
        },
        relations: ['barcode'],
        order: {
          createdAt: 'DESC',
        },
      });

      this.logger.log(
        `[findByWarehouseId] Найдено ${services.length} услуг для склада ${warehouseId}`
      );

      // Логируем первые несколько услуг для диагностики
      if (services.length > 0) {
        this.logger.debug(
          `[findByWarehouseId] Примеры услуг: ${JSON.stringify(
            services.slice(0, 2).map((s) => ({
              id: s.id,
              warehouseId: s.warehouseId,
              barcode: s.barcode
                ? { id: s.barcode.id, productName: s.barcode.productName }
                : null,
            }))
          )}`
        );
      }

      return services;
    } catch (error) {
      this.logger.error(
        `[findByWarehouseId] Ошибка при получении услуг: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async findOne(id: string, userId: string): Promise<Service> {
    this.logger.log(`[findOne] Получение услуги по ID ${id}, userId=${userId}`);

    const service = await this.serviceRepository.findOne({
      where: { id },
      relations: ['barcode', 'warehouse'],
    });

    if (!service) {
      this.logger.warn(`[findOne] Услуга с ID ${id} не найдена`);
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    this.logger.debug(
      `[findOne] Услуга найдена: ${JSON.stringify({
        id: service.id,
        warehouseId: service.warehouseId,
        barcode: service.barcode ? { id: service.barcode.id } : null,
      })}`
    );

    await this.validateAccess(userId, service.warehouseId);

    return service;
  }

  async update(
    id: string,
    updateWarehouseServiceDto: any,
    userId: string
  ): Promise<Service> {
    this.logger.log(`[update] Обновление услуги ${id}, userId=${userId}`);
    this.logger.debug(
      `[update] Данные для обновления: ${JSON.stringify(
        updateWarehouseServiceDto
      )}`
    );

    const service = await this.findOne(id, userId);

    if (updateWarehouseServiceDto.warehouseId) {
      this.logger.debug(
        `[update] Проверка доступа к новому складу ${updateWarehouseServiceDto.warehouseId}`
      );
      await this.validateAccess(userId, updateWarehouseServiceDto.warehouseId);
    }

    // Update the service
    this.logger.debug(`[update] Объединение данных`);
    this.serviceRepository.merge(service, updateWarehouseServiceDto);

    this.logger.debug(`[update] Сохранение обновленной услуги`);
    const result = await this.serviceRepository.save(service);
    this.logger.log(`[update] Услуга ${id} успешно обновлена`);

    return result;
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`[remove] Удаление услуги ${id}, userId=${userId}`);

    const service = await this.findOne(id, userId);

    this.logger.debug(`[remove] Услуга найдена, выполняется удаление`);
    await this.serviceRepository.remove(service);
    this.logger.log(`[remove] Услуга ${id} успешно удалена`);
  }
}
