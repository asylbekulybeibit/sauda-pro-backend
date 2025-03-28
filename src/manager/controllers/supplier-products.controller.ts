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
import { Barcode } from '../entities/barcode.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';

@Controller('manager/shop/:shopId/suppliers')
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
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<any[]> {
    return this.supplierProductsService.getSupplierProducts(supplierId, shopId);
  }

  @Post(':supplierId/products/:barcodeId')
  addProductToSupplier(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('barcodeId', ParseUUIDPipe) barcodeId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() data: { price: number; minimumOrder?: number }
  ): Promise<SupplierProduct> {
    return this.supplierProductsService.addProductToSupplier(
      supplierId,
      barcodeId,
      data,
      shopId
    );
  }

  @Delete(':supplierId/products/:barcodeId')
  removeProductFromSupplier(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('barcodeId', ParseUUIDPipe) barcodeId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<void> {
    return this.supplierProductsService.removeProductFromSupplier(
      supplierId,
      barcodeId,
      shopId
    );
  }
}
