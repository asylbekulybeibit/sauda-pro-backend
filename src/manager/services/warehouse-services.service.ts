import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WarehouseService } from '../entities/warehouse-service.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { Barcode } from '../entities/barcode.entity';
import { CreateWarehouseServiceDto } from '../dto/warehouse-service/create-warehouse-service.dto';
import { UpdateWarehouseServiceDto } from '../dto/warehouse-service/update-warehouse-service.dto';

@Injectable()
export class WarehouseServicesService {
  constructor(
    @InjectRepository(WarehouseService)
    private readonly warehouseServiceRepository: Repository<WarehouseService>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>
  ) {}

  private async validateAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
      relations: ['shop'],
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
    }

    // Additional access validation logic can be added here
  }

  async create(
    createWarehouseServiceDto: CreateWarehouseServiceDto,
    userId: string
  ): Promise<WarehouseService> {
    await this.validateAccess(userId, createWarehouseServiceDto.warehouseId);

    // Create new warehouse service
    const warehouseService = this.warehouseServiceRepository.create(
      createWarehouseServiceDto
    );
    return this.warehouseServiceRepository.save(warehouseService);
  }

  async findAllByShop(
    shopId: string,
    userId: string
  ): Promise<WarehouseService[]> {
    // Find all warehouses associated with this shop
    const warehouses = await this.warehouseRepository.find({
      where: { shopId },
    });

    const warehouseIds = warehouses.map((warehouse) => warehouse.id);

    // Find all services for these warehouses
    const services = await this.warehouseServiceRepository.find({
      where: {
        warehouseId: warehouseIds.length > 0 ? In(warehouseIds) : 'dummy',
        isActive: true,
      },
      relations: ['barcode'],
    });

    return services;
  }

  async findOne(id: string, userId: string): Promise<WarehouseService> {
    const warehouseService = await this.warehouseServiceRepository.findOne({
      where: { id },
      relations: ['barcode', 'warehouse'],
    });

    if (!warehouseService) {
      throw new NotFoundException(`Warehouse service with ID ${id} not found`);
    }

    await this.validateAccess(userId, warehouseService.warehouseId);

    return warehouseService;
  }

  async update(
    id: string,
    updateWarehouseServiceDto: UpdateWarehouseServiceDto,
    userId: string
  ): Promise<WarehouseService> {
    const warehouseService = await this.findOne(id, userId);

    if (updateWarehouseServiceDto.warehouseId) {
      await this.validateAccess(userId, updateWarehouseServiceDto.warehouseId);
    }

    // Update the warehouse service
    this.warehouseServiceRepository.merge(
      warehouseService,
      updateWarehouseServiceDto
    );
    return this.warehouseServiceRepository.save(warehouseService);
  }

  async remove(id: string, userId: string): Promise<void> {
    const warehouseService = await this.findOne(id, userId);
    await this.warehouseServiceRepository.remove(warehouseService);
  }
}
