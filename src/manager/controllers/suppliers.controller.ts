import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Logger,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { Supplier } from '../entities/supplier.entity';

@Controller('manager/shop/:shopId/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class SuppliersController {
  private readonly logger = new Logger(SuppliersController.name);

  constructor(
    private readonly suppliersService: SuppliersService,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>
  ) {}

  @Post()
  async create(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    this.logger.log(`[create] Создание поставщика для магазина ${shopId}`);

    return this.suppliersService.create(req.user.id, {
      ...createSupplierDto,
      shopId,
    });
  }

  @Get()
  async findAll(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Supplier[]> {
    this.logger.log(`[findAll] Получение поставщиков для магазина ${shopId}`);

    return this.suppliersService.findAll(req.user.id, shopId);
  }

  @Get(':id')
  async findOne(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Supplier> {
    this.logger.log(
      `[findOne] Получение поставщика ${id} для магазина ${shopId}`
    );

    return this.suppliersService.findOne(req.user.id, shopId, id);
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    this.logger.log(
      `[update] Обновление поставщика ${id} для магазина ${shopId}`
    );

    return this.suppliersService.update(
      req.user.id,
      shopId,
      id,
      updateSupplierDto
    );
  }

  @Delete(':id')
  async remove(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    this.logger.log(
      `[remove] Удаление поставщика ${id} для магазина ${shopId}`
    );

    return this.suppliersService.remove(req.user.id, shopId, id);
  }
}
