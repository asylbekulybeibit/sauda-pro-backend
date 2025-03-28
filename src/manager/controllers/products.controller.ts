import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { WarehouseProductsService } from '../services/warehouse-products.service';

@Controller('manager/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly warehouseProductsService: WarehouseProductsService,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  @Post()
  async createProduct(@Body() createProductDto: any, @Request() req) {
    this.logger.log(
      `[createProduct] Перенаправление запроса на создание товара, userId=${req.user.id}`
    );

    try {
      // Получаем роль менеджера для определения склада
      const managerRole = await this.userRoleRepository.findOne({
        where: {
          userId: req.user.id,
          type: RoleType.MANAGER,
          isActive: true,
        },
        relations: ['warehouse'],
      });

      if (!managerRole || !managerRole.warehouse) {
        this.logger.error(
          `[createProduct] Роль менеджера не найдена для userId=${req.user.id}`
        );
        throw new Error('У вас нет прав менеджера склада');
      }

      // Преобразуем входные данные в формат, ожидаемый сервисом
      const productDto = {
        warehouseId: createProductDto.warehouseId || managerRole.warehouse.id,
        barcodeId: createProductDto.barcodeId,
        barcode: createProductDto.barcode,
        name:
          createProductDto.name ||
          createProductDto.productName ||
          'Новый товар',
        description: createProductDto.description || '',
        categoryId: createProductDto.categoryId,
        quantity: createProductDto.quantity || 0,
        purchasePrice:
          createProductDto.price || createProductDto.purchasePrice || 0,
        sellingPrice:
          createProductDto.price || createProductDto.sellingPrice || 0,
        minQuantity: createProductDto.minQuantity || 0,
        isActive: true,
      };

      this.logger.debug(
        `[createProduct] Создание товара для склада ${productDto.warehouseId}`
      );

      this.logger.debug(
        `[createProduct] Данные товара: ${JSON.stringify(productDto)}`
      );

      // Используем сервис для создания товара
      const createdProduct =
        await this.warehouseProductsService.createWarehouseProduct(productDto);

      // Загружаем полную информацию о товаре с штрихкодом
      const productWithBarcode =
        await this.warehouseProductsService.getWarehouseProductById(
          createdProduct.id
        );

      this.logger.debug(
        `[createProduct] Товар успешно создан: ${JSON.stringify(
          productWithBarcode
        )}`
      );

      return productWithBarcode;
    } catch (error) {
      this.logger.error(
        `[createProduct] Ошибка при создании товара: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Get(':shopId')
  async getProducts(@Param('shopId') shopId: string, @Request() req) {
    // Перенаправляем на метод getWarehouseProductsByShop
    this.logger.log(
      `[getProducts] Перенаправление запроса на получение товаров для магазина ${shopId}, userId=${req.user.id}`
    );

    // В реальной имплементации нужно вызвать сервис для получения товаров
    return this.warehouseProductsService.getWarehouseProductsByShop(shopId);
  }
}
