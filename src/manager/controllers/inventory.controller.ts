import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { InventoryService } from '../services/inventory.service';
import {
  CreateTransactionDto,
  CreatePurchaseDto,
  TransactionType,
} from '../dto/inventory/create-transaction.dto';
import { RoleType } from '../../auth/types/role.type';
import { CreateInventoryDto } from '../dto/create-inventory.dto';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { InventoryTransaction } from '../entities/inventory-transaction.entity';
import { PurchasesService } from '../services/purchases.service';
import { PurchaseWithItems } from '../interfaces/purchase-with-items.interface';
import { Purchase } from '../entities/purchase.entity';

@Controller('manager/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly purchasesService: PurchasesService
  ) {}

  /**
   * Создание транзакции инвентаризации
   * @param createTransactionDto данные транзакции
   * @param req запрос с данными пользователя
   */
  @Post('transactions')
  createTransaction(
    @Body() createTransactionDto: CreateTransactionDto,
    @Request() req
  ) {
    return this.inventoryService.createTransaction(
      req.user.id,
      createTransactionDto
    );
  }

  /**
   * Создание прихода товаров
   * @param createPurchaseDto данные прихода
   * @param req запрос с данными пользователя
   */
  @Post('purchases')
  async createPurchase(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Request() req
  ): Promise<PurchaseWithItems> {
    console.log('Redirecting to new purchases service');
    // Перенаправляем запрос на новый сервис
    return this.purchasesService.createPurchase(req.user.id, createPurchaseDto);
  }

  /**
   * Получение всех транзакций магазина
   */
  @Get('transactions/:shopId')
  getTransactions(@Param('shopId') shopId: string, @Request() req) {
    return this.inventoryService.getTransactions(req.user.id, shopId);
  }

  /**
   * Получение транзакций по конкретному товару
   */
  @Get('products/:productId/transactions')
  getProductTransactions(
    @Param('productId') productId: string,
    @Request() req
  ) {
    return this.inventoryService.getProductTransactions(req.user.id, productId);
  }

  /**
   * Получение товаров с низким остатком
   */
  @Get('low-stock/:shopId')
  getLowStockProducts(@Param('shopId') shopId: string, @Request() req) {
    return this.inventoryService.getLowStockProducts(req.user.id, shopId);
  }

  /**
   * Создание инвентаризации (проверки остатков)
   */
  @Post()
  create(@Body() createInventoryDto: CreateInventoryDto, @Request() req) {
    return this.inventoryService.create(createInventoryDto, req.user.id);
  }

  /**
   * Получение всех инвентаризаций магазина
   */
  @Get('shop/:shopId')
  findAll(@Param('shopId') shopId: string) {
    return this.inventoryService.findAll(shopId);
  }

  /**
   * Получение конкретной инвентаризации
   */
  @Get(':id/shop/:shopId')
  findOne(@Param('id') id: string, @Param('shopId') shopId: string) {
    return this.inventoryService.findOne(+id, shopId);
  }

  @Get('sales/:shopId')
  async getSales(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<InventoryTransaction[]> {
    return this.inventoryService.getSales(req.user.id, shopId);
  }

  @Get('returns/:shopId')
  async getReturns(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<InventoryTransaction[]> {
    return this.inventoryService.getReturns(req.user.id, shopId);
  }

  @Get('write-offs/:shopId')
  async getWriteOffs(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<InventoryTransaction[]> {
    console.log(
      'Write-offs endpoint called with shopId:',
      shopId,
      'user:',
      req.user
    );
    try {
      const result = await this.inventoryService.getWriteOffs(
        req.user.id,
        shopId
      );
      console.log('Write-offs endpoint response:', result);
      return result;
    } catch (error) {
      console.error('Error in getWriteOffs:', error);
      throw error;
    }
  }

  @Get('purchases/:shopId')
  async getPurchases(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Request() req
  ): Promise<PurchaseWithItems[]> {
    console.log(
      'Purchases endpoint called with shopId:',
      shopId,
      'user:',
      req.user
    );
    try {
      // Перенаправляем запрос на новый сервис
      const result = await this.purchasesService.findAll(req.user.id, shopId);
      console.log('Purchases endpoint response length:', result.length);
      return result;
    } catch (error) {
      console.error('Error in getPurchases:', error);
      throw error;
    }
  }

  @Delete('purchases/:shopId/:purchaseId')
  async deletePurchase(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string
  ): Promise<{ success: boolean }> {
    console.log(
      'Delete purchase endpoint called with shopId:',
      shopId,
      'purchaseId:',
      purchaseId,
      'user:',
      req.user
    );
    try {
      // Перенаправляем запрос на новый сервис
      await this.purchasesService.deletePurchase(
        req.user.id,
        purchaseId,
        shopId
      );
      return { success: true };
    } catch (error) {
      console.error('Error in deletePurchase:', error);
      throw error;
    }
  }
}
