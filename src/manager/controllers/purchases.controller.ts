import {
  Controller,
  Get,
  Post,
  Body,
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
import { PurchasesService } from '../services/purchases.service';
import { CreatePurchaseDto } from '../dto/purchases/create-purchase.dto';
import { PurchaseWithItems } from '../interfaces/purchase-with-items.interface';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('manager/purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  async createPurchase(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Request() req
  ): Promise<PurchaseWithItems> {
    console.log(
      '[PurchasesController] Received createPurchase request from user ID:',
      req.user.id
    );
    console.log(
      '[PurchasesController] Request body:',
      JSON.stringify(createPurchaseDto, null, 2)
    );

    try {
      const result = await this.purchasesService.createPurchase(
        req.user.id,
        createPurchaseDto
      );
      console.log(
        '[PurchasesController] Purchase created successfully with ID:',
        result.id
      );
      return result;
    } catch (error) {
      console.error('[PurchasesController] Error creating purchase:', error);
      throw error;
    }
  }

  @Post('no-supplier')
  async createPurchaseWithoutSupplier(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Request() req
  ): Promise<PurchaseWithItems> {
    console.log(
      '[PurchasesController] Received createPurchaseWithoutSupplier request'
    );
    console.log(
      '[PurchasesController] Request body:',
      JSON.stringify(createPurchaseDto, null, 2)
    );

    // Явно устанавливаем supplierId в null
    createPurchaseDto.supplierId = null;

    try {
      const result = await this.purchasesService.createPurchase(
        req.user.id,
        createPurchaseDto
      );
      console.log(
        '[PurchasesController] Purchase created successfully without supplier, ID:',
        result.id
      );
      return result;
    } catch (error) {
      console.error(
        '[PurchasesController] Error creating purchase without supplier:',
        error
      );
      throw error;
    }
  }

  @Get(':warehouseId')
  async getPurchases(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Request() req
  ): Promise<PurchaseWithItems[]> {
    return this.purchasesService.findAll(req.user.id, warehouseId);
  }

  @Get(':warehouseId/:id')
  @ApiOperation({ summary: 'Get purchase by ID and warehouse ID' })
  @ApiResponse({ status: 200, description: 'Returns purchase details' })
  async getPurchase(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<PurchaseWithItems> {
    console.log(
      '[PurchasesController] Getting purchase by ID:',
      id,
      'warehouseId:',
      warehouseId
    );
    return this.purchasesService.findOne(id, warehouseId);
  }

  @Delete(':warehouseId/:id')
  async deletePurchase(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<{ success: boolean }> {
    await this.purchasesService.deletePurchase(req.user.id, id, warehouseId);
    return { success: true };
  }
}
