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

  @Post('shop/:shopId')
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.create(createEmployeeDto, req.user.id, shopId);
  }

  @Get('shop/:shopId')
  findAll(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.employeeService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/active')
  findAllActive(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.findAllActive(req.user.id, shopId);
  }

  @Get('shop/:shopId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.findOne(id, req.user.id, shopId);
  }

  @Patch('shop/:shopId/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.update(
      id,
      updateEmployeeDto,
      req.user.id,
      shopId
    );
  }

  @Delete('shop/:shopId/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.employeeService.remove(id, req.user.id, shopId);
  }
}
