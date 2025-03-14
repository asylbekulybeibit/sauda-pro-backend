import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
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

@Controller('manager/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

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
   * Создание прихода товара
   * @param createPurchaseDto данные прихода
   * @param req запрос с данными пользователя
   */
  @Post('purchases')
  createPurchase(@Body() createPurchaseDto: CreatePurchaseDto, @Request() req) {
    // Преобразуем приход в несколько транзакций
    const transactions = createPurchaseDto.items.map((item) => ({
      shopId: createPurchaseDto.shopId,
      type: TransactionType.PURCHASE,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      metadata: {
        supplierId: createPurchaseDto.supplierId,
        invoiceNumber: createPurchaseDto.invoiceNumber,
        serialNumber: item.serialNumber,
        expiryDate: item.expiryDate,
      },
      comment: createPurchaseDto.comment,
    }));

    // Создаем транзакции последовательно
    return Promise.all(
      transactions.map((transaction) =>
        this.inventoryService.createTransaction(req.user.id, transaction)
      )
    );
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
}
