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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { EmployeeService } from '../services/employee.service';
import { CreateEmployeeDto } from '../dto/staff/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/staff/update-employee.dto';

@Controller('manager/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('shop/:shopId')
  findAllByShop(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.findAllByShop(req.user.id, shopId);
  }

  @Get('shop/:shopId/active')
  findAllActiveByShop(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.findAllActiveByShop(req.user.id, shopId);
  }

  @Get('shop/:shopId/warehouse/:warehouseId')
  findAllByWarehouse(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    console.log(
      `[EmployeeController.findAllByWarehouse] Получен запрос: userId=${req.user.id}, shopId=${shopId}, warehouseId=${warehouseId}`
    );
    const result = this.employeeService.findAllByWarehouse(
      req.user.id,
      shopId,
      warehouseId
    );
    console.log(`[EmployeeController.findAllByWarehouse] Запрос обработан`);
    return result;
  }

  @Get('shop/:shopId/warehouse/:warehouseId/active')
  findAllActiveByWarehouse(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    console.log(
      `[EmployeeController.findAllActiveByWarehouse] Получен запрос: userId=${req.user.id}, shopId=${shopId}, warehouseId=${warehouseId}`
    );
    const result = this.employeeService.findAllActiveByWarehouse(
      req.user.id,
      shopId,
      warehouseId
    );
    console.log(
      `[EmployeeController.findAllActiveByWarehouse] Запрос обработан`
    );
    return result;
  }

  @Post('shop/:shopId')
  createByShop(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.createByShop(
      createEmployeeDto,
      req.user.id,
      shopId
    );
  }

  @Post('warehouse/:warehouseId')
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.employeeService.create(
      createEmployeeDto,
      req.user.id,
      warehouseId
    );
  }

  @Get('warehouse/:warehouseId')
  findAll(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.employeeService.findAll(req.user.id, warehouseId);
  }

  @Get('warehouse/:warehouseId/active')
  findAllActive(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.employeeService.findAllActive(req.user.id, warehouseId);
  }

  @Get('warehouse/:warehouseId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.employeeService.findOne(id, req.user.id, warehouseId);
  }

  @Patch('warehouse/:warehouseId/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.employeeService.update(
      id,
      updateEmployeeDto,
      req.user.id,
      warehouseId
    );
  }

  @Delete('warehouse/:warehouseId/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.employeeService.remove(id, req.user.id, warehouseId);
  }

  @Get('shop/:shopId/:id')
  findOneByShop(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.findOneByShop(id, req.user.id, shopId);
  }

  @Patch('shop/:shopId/:id')
  updateByShop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.updateByShop(
      id,
      updateEmployeeDto,
      req.user.id,
      shopId
    );
  }

  @Delete('shop/:shopId/:id')
  removeByShop(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.removeByShop(id, req.user.id, shopId);
  }
}
