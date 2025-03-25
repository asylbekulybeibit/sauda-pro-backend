import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../auth/types/role.type';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  private readonly logger = new Logger(WarehousesController.name);

  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(RoleType.SUPERADMIN, RoleType.OWNER)
  async create(@Body() createWarehouseDto: CreateWarehouseDto) {
    this.logger.debug('Создание нового склада:', createWarehouseDto);
    return this.warehousesService.create(createWarehouseDto);
  }

  @Get()
  @Roles(RoleType.SUPERADMIN, RoleType.OWNER)
  async findAll() {
    this.logger.debug('Получение списка всех складов');
    return this.warehousesService.findAll();
  }

  @Get(':id')
  @Roles(RoleType.SUPERADMIN, RoleType.OWNER)
  async findOne(@Param('id') id: string) {
    this.logger.debug(`Получение склада по ID: ${id}`);
    return this.warehousesService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleType.SUPERADMIN, RoleType.OWNER)
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto
  ) {
    this.logger.debug(`Обновление склада ${id}:`, updateWarehouseDto);
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  @Delete(':id')
  @Roles(RoleType.SUPERADMIN, RoleType.OWNER)
  async remove(@Param('id') id: string) {
    try {
      await this.warehousesService.remove(id);
      return { message: 'Склад успешно деактивирован' };
    } catch (error) {
      this.logger.error(`Ошибка при деактивации склада: ${error.message}`);
      throw error;
    }
  }
}
