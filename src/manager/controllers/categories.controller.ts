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
  Query,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto } from '../dto/categories/create-category.dto';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';

@Controller('manager/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(
    private readonly categoriesService: CategoriesService,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>
  ) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto, @Request() req) {
    return this.categoriesService.create(createCategoryDto, req.user.id);
  }

  @Get('shop/:shopId')
  async findByShop(
    @Param('shopId') shopId: string,
    @Request() req,
    @Query('isWarehouseId') isWarehouseId?: string
  ) {
    this.logger.log(
      `[findByShop] Получение категорий для ${
        isWarehouseId === 'true' ? 'склада' : 'магазина'
      } ${shopId}, userId=${req.user.id}`
    );

    // Проверяем, является ли переданный ID идентификатором склада
    if (isWarehouseId === 'true') {
      this.logger.log(
        `[findByShop] Определяем ID магазина по ID склада: ${shopId}`
      );

      try {
        // Получаем склад по ID с более детальным логированием
        this.logger.debug(`[findByShop] Запрос склада из БД с ID ${shopId}`);
        const warehouse = await this.warehouseRepository.findOne({
          where: { id: shopId },
        });

        if (!warehouse) {
          this.logger.error(`[findByShop] Склад с ID ${shopId} не найден`);
          // Возможно, у менеджера есть прямой доступ к магазину
          // Пытаемся найти роль с прямым доступом к магазину
          this.logger.debug(
            `[findByShop] Проверяем прямой доступ менеджера к магазину`
          );

          // В этом случае просто пробуем получить категории напрямую
          return this.categoriesService.findByShop(shopId, req.user.id);
        }

        // Используем ID магазина из склада
        const actualShopId = warehouse.shopId;
        this.logger.log(
          `[findByShop] Определен ID магазина: ${actualShopId} для склада: ${shopId}`
        );

        return this.categoriesService.findByShop(actualShopId, req.user.id);
      } catch (error) {
        this.logger.error(
          `[findByShop] Ошибка при поиске склада: ${error.message}`
        );
        throw new NotFoundException(
          `Склад с ID ${shopId} не найден: ${error.message}`
        );
      }
    }

    // Если isWarehouseId не указан или false, используем переданный shopId
    return this.categoriesService.findByShop(shopId, req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.categoriesService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.categoriesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: Partial<CreateCategoryDto>,
    @Request() req
  ) {
    return this.categoriesService.update(id, updateCategoryDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.categoriesService.remove(id, req.user.id);
  }
}
