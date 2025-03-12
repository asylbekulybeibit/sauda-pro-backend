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
import { RoleType } from '../../roles/entities/user-role.entity';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { Supplier } from '../entities/supplier.entity';

@Controller('manager/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(
    @Request() req,
    @Body() createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    return this.suppliersService.create(req.user.id, createSupplierDto);
  }

  @Get('shop/:shopId')
  findAll(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Supplier[]> {
    return this.suppliersService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/supplier/:id')
  findOne(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Supplier> {
    return this.suppliersService.findOne(req.user.id, shopId, id);
  }

  @Patch('shop/:shopId/supplier/:id')
  update(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    return this.suppliersService.update(
      req.user.id,
      shopId,
      id,
      updateSupplierDto
    );
  }

  @Delete('shop/:shopId/supplier/:id')
  remove(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    return this.suppliersService.remove(req.user.id, shopId, id);
  }
}
