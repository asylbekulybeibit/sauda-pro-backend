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
import { ShopsService } from './shops.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../roles/entities/user-role.entity';

@Controller('shops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShopsController {
  private readonly logger = new Logger(ShopsController.name);

  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  @Roles(RoleType.SUPERADMIN)
  async create(@Body() createShopDto: CreateShopDto) {
    this.logger.debug('Создание нового магазина:', createShopDto);
    return this.shopsService.create(createShopDto);
  }

  @Get()
  @Roles(RoleType.SUPERADMIN)
  async findAll() {
    this.logger.debug('Получение списка всех магазинов');
    return this.shopsService.findAll();
  }

  @Get(':id')
  @Roles(RoleType.SUPERADMIN)
  async findOne(@Param('id') id: string) {
    this.logger.debug(`Получение магазина по ID: ${id}`);
    return this.shopsService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleType.SUPERADMIN)
  async update(@Param('id') id: string, @Body() updateShopDto: UpdateShopDto) {
    this.logger.debug(`Обновление магазина ${id}:`, updateShopDto);
    return this.shopsService.update(id, updateShopDto);
  }

  @Delete(':id')
  @Roles(RoleType.SUPERADMIN)
  async remove(@Param('id') id: string) {
    this.logger.debug(`Удаление магазина ${id}`);
    return this.shopsService.remove(id);
  }
}
