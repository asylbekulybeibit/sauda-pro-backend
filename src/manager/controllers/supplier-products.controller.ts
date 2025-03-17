import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { SupplierProductsService } from '../services/supplier-products.service';
import { Product } from '../entities/product.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';

@Controller('manager/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class SupplierProductsController {
  constructor(
    private readonly supplierProductsService: SupplierProductsService
  ) {}

  @Get(':supplierId/products')
  getSupplierProducts(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Product[]> {
    return this.supplierProductsService.getSupplierProducts(
      req.user.id,
      supplierId,
      shopId
    );
  }

  @Post(':supplierId/products/:productId')
  addProductToSupplier(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('shopId', ParseUUIDPipe) shopId: string,
    @Body() data: { price: number; minimumOrder?: number }
  ): Promise<SupplierProduct> {
    return this.supplierProductsService.addProductToSupplier(
      req.user.id,
      supplierId,
      productId,
      shopId,
      data
    );
  }

  @Delete(':supplierId/products/:productId')
  removeProductFromSupplier(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('shopId', ParseUUIDPipe) shopId: string
  ): Promise<void> {
    return this.supplierProductsService.removeProductFromSupplier(
      req.user.id,
      supplierId,
      productId,
      shopId
    );
  }
}
