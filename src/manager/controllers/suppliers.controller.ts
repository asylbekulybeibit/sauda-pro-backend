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
  ForbiddenException,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { Supplier } from '../entities/supplier.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { SupplierProductsService } from '../services/supplier-products.service';

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
    private readonly suppliersRepository: Repository<Supplier>,
    private readonly supplierProductsService: SupplierProductsService
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

  @Get(':supplierId/products')
  async getSupplierProducts(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('shopId') shopId?: string
  ): Promise<any[]> {
    this.logger.log(
      `[getSupplierProducts] Получение товаров поставщика с ID=${supplierId}, shopId=${shopId}, userId=${req.user.id}`
    );

    try {
      // Получаем информацию о поставщике
      const supplier = await this.suppliersRepository.findOne({
        where: { id: supplierId, isActive: true },
        relations: ['shop'],
      });

      if (!supplier) {
        this.logger.warn(
          `[getSupplierProducts] Поставщик с ID ${supplierId} не найден`
        );
        throw new NotFoundException(`Поставщик с ID ${supplierId} не найден`);
      }

      this.logger.debug(
        `[getSupplierProducts] Найден поставщик: ${JSON.stringify({
          id: supplier.id,
          name: supplier.name,
          shopId: supplier.shopId,
        })}`
      );

      // Проверяем, имеет ли менеджер доступ к магазину этого поставщика
      await this.suppliersService.validateManagerAccess(
        req.user.id,
        supplier.shopId
      );

      return this.supplierProductsService.getSupplierProducts(
        supplierId,
        supplier.shopId
      );
    } catch (error) {
      this.logger.error(
        `[getSupplierProducts] Ошибка при получении товаров поставщика: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Post(':supplierId/products/:barcodeId')
  async addProductToSupplier(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('barcodeId', ParseUUIDPipe) barcodeId: string,
    @Body() data: { price: number; minimumOrder?: number },
    @Query('shopId') shopId?: string
  ): Promise<any> {
    this.logger.log(
      `[addProductToSupplier] Добавление товара ${barcodeId} поставщику ${supplierId}, userId=${req.user.id}`
    );

    try {
      // Получаем информацию о поставщике
      const supplier = await this.suppliersRepository.findOne({
        where: { id: supplierId, isActive: true },
        relations: ['shop'],
      });

      if (!supplier) {
        this.logger.warn(
          `[addProductToSupplier] Поставщик с ID ${supplierId} не найден`
        );
        throw new NotFoundException(`Поставщик с ID ${supplierId} не найден`);
      }

      // Проверяем, имеет ли менеджер доступ к магазину этого поставщика
      await this.suppliersService.validateManagerAccess(
        req.user.id,
        supplier.shopId
      );

      return this.supplierProductsService.addProductToSupplier(
        supplierId,
        barcodeId,
        data,
        supplier.shopId
      );
    } catch (error) {
      this.logger.error(
        `[addProductToSupplier] Ошибка при добавлении товара поставщику: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Delete(':supplierId/products/:barcodeId')
  async removeProductFromSupplier(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('barcodeId', ParseUUIDPipe) barcodeId: string,
    @Query('shopId') shopId?: string
  ): Promise<void> {
    this.logger.log(
      `[removeProductFromSupplier] Удаление товара ${barcodeId} у поставщика ${supplierId}, userId=${req.user.id}`
    );

    try {
      // Получаем информацию о поставщике
      const supplier = await this.suppliersRepository.findOne({
        where: { id: supplierId, isActive: true },
        relations: ['shop'],
      });

      if (!supplier) {
        this.logger.warn(
          `[removeProductFromSupplier] Поставщик с ID ${supplierId} не найден`
        );
        throw new NotFoundException(`Поставщик с ID ${supplierId} не найден`);
      }

      // Проверяем, имеет ли менеджер доступ к магазину этого поставщика
      await this.suppliersService.validateManagerAccess(
        req.user.id,
        supplier.shopId
      );

      return this.supplierProductsService.removeProductFromSupplier(
        supplierId,
        barcodeId,
        supplier.shopId
      );
    } catch (error) {
      this.logger.error(
        `[removeProductFromSupplier] Ошибка при удалении товара у поставщика: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
