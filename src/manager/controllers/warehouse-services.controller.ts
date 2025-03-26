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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { WarehouseServicesService } from '../services/warehouse-services.service';
import { CreateWarehouseServiceDto } from '../dto/warehouse-service/create-warehouse-service.dto';
import { UpdateWarehouseServiceDto } from '../dto/warehouse-service/update-warehouse-service.dto';

@Controller('manager/warehouse-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class WarehouseServicesController {
  constructor(
    private readonly warehouseServicesService: WarehouseServicesService
  ) {}

  @Post()
  create(
    @Body() createWarehouseServiceDto: CreateWarehouseServiceDto,
    @Request() req
  ) {
    return this.warehouseServicesService.create(
      createWarehouseServiceDto,
      req.user.id
    );
  }

  @Get('shop/:shopId')
  findAllByShop(@Param('shopId') shopId: string, @Request() req) {
    return this.warehouseServicesService.findAllByShop(shopId, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.warehouseServicesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWarehouseServiceDto: UpdateWarehouseServiceDto,
    @Request() req
  ) {
    return this.warehouseServicesService.update(
      id,
      updateWarehouseServiceDto,
      req.user.id
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.warehouseServicesService.remove(id, req.user.id);
  }
}
