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
  TransactionType,
  CreatePurchaseDto as InventoryCreatePurchaseDto,
} from '../dto/inventory/create-transaction.dto';
import { RoleType } from '../../auth/types/role.type';
import { CreateInventoryDto } from '../dto/create-inventory.dto';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { InventoryTransaction } from '../entities/inventory-transaction.entity';
import { PurchasesService } from '../services/purchases.service';
import { PurchaseWithItems } from '../interfaces/purchase-with-items.interface';
import { Purchase } from '../entities/purchase.entity';
import { CreatePurchaseDto } from '../dto/purchases/create-purchase.dto';

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
    @Body() inventoryPurchaseDto: InventoryCreatePurchaseDto,
    @Request() req
  ): Promise<PurchaseWithItems> {
    console.log('Redirecting to new purchases service');

    // Конвертируем DTO из формата inventory в формат purchases
    const purchaseDto = new CreatePurchaseDto();
    purchaseDto.warehouseId = inventoryPurchaseDto.warehouseId;
    purchaseDto.supplierId = inventoryPurchaseDto.supplierId;
    purchaseDto.invoiceNumber = inventoryPurchaseDto.invoiceNumber;
    purchaseDto.date = inventoryPurchaseDto.date;
    purchaseDto.comment = inventoryPurchaseDto.comment;
    purchaseDto.updatePrices = inventoryPurchaseDto.updatePrices;
    purchaseDto.updatePurchasePrices =
      inventoryPurchaseDto.updatePurchasePrices;
    purchaseDto.createLabels = inventoryPurchaseDto.createLabels;

    // Преобразуем элементы со старого формата (warehouseProductId) в новый (productId)
    purchaseDto.items = inventoryPurchaseDto.items.map((item) => ({
      productId: item.warehouseProductId, // Маппинг ключевого поля
      quantity: item.quantity,
      price: item.price,
      serialNumber: item.serialNumber,
      expiryDate: item.expiryDate,
      comment: item.comment,
      partialQuantity: item.partialQuantity,
    }));

    // Перенаправляем запрос на новый сервис
    return this.purchasesService.createPurchase(req.user.id, purchaseDto);
  }

  /**
   * Получение всех транзакций магазина
   */
  @Get('transactions/:warehouseId')
  getTransactions(@Param('warehouseId') warehouseId: string, @Request() req) {
    return this.inventoryService.getTransactions(req.user.id, warehouseId);
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
  @Get('low-stock/:warehouseId')
  getLowStockProducts(
    @Param('warehouseId') warehouseId: string,
    @Request() req
  ) {
    return this.inventoryService.getLowStockProducts(req.user.id, warehouseId);
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
  @Get('warehouse/:warehouseId')
  findAll(@Param('warehouseId') warehouseId: string) {
    return this.inventoryService.findAll(warehouseId);
  }

  /**
   * Получение конкретной инвентаризации
   */
  @Get(':id/warehouse/:warehouseId')
  findOne(@Param('id') id: string, @Param('warehouseId') warehouseId: string) {
    return this.inventoryService.findOne(+id, warehouseId);
  }

  @Get('sales/:warehouseId')
  async getSales(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<InventoryTransaction[]> {
    return this.inventoryService.getSales(req.user.id, warehouseId);
  }

  @Get('returns/:warehouseId')
  async getReturns(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<InventoryTransaction[]> {
    return this.inventoryService.getReturns(req.user.id, warehouseId);
  }

  @Get('write-offs/:warehouseId')
  async getWriteOffs(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<InventoryTransaction[]> {
    console.log(
      'Write-offs endpoint called with warehouseId:',
      warehouseId,
      'user:',
      req.user
    );
    try {
      const result = await this.inventoryService.getWriteOffs(
        req.user.id,
        warehouseId
      );
      console.log('Write-offs endpoint response:', result);
      return result;
    } catch (error) {
      console.error('Error in getWriteOffs:', error);
      throw error;
    }
  }

  @Get('purchases/:warehouseId')
  async getPurchases(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Request() req
  ): Promise<PurchaseWithItems[]> {
    console.log(
      'Purchases endpoint called with warehouseId:',
      warehouseId,
      'user:',
      req.user
    );
    try {
      // Перенаправляем запрос на новый сервис
      const result = await this.purchasesService.findAll(
        req.user.id,
        warehouseId
      );
      console.log('Purchases endpoint response length:', result.length);
      return result;
    } catch (error) {
      console.error('Error in getPurchases:', error);
      throw error;
    }
  }

  @Delete('purchases/:warehouseId/:purchaseId')
  async deletePurchase(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string
  ): Promise<{ success: boolean }> {
    console.log(
      'Delete purchase endpoint called with warehouseId:',
      warehouseId,
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
        warehouseId
      );
      return { success: true };
    } catch (error) {
      console.error('Error in deletePurchase:', error);
      throw error;
    }
  }
}
