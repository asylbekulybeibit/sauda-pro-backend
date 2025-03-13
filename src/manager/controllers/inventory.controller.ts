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
import { CreateTransactionDto } from '../dto/inventory/create-transaction.dto';
import { RoleType } from '../../auth/types/role.type';

@Controller('manager/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

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

  @Get('transactions/:shopId')
  getTransactions(@Param('shopId') shopId: string, @Request() req) {
    return this.inventoryService.getTransactions(req.user.id, shopId);
  }

  @Get('products/:productId/transactions')
  getProductTransactions(
    @Param('productId') productId: string,
    @Request() req
  ) {
    return this.inventoryService.getProductTransactions(req.user.id, productId);
  }

  @Get('low-stock/:shopId')
  getLowStockProducts(@Param('shopId') shopId: string, @Request() req) {
    return this.inventoryService.getLowStockProducts(req.user.id, shopId);
  }
}
