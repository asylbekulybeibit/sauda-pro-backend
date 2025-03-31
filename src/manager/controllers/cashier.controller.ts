import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashierService } from '../services/cashier.service';

@Controller('manager/:warehouseId/cashier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER, RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  /**
   * Поиск товаров по штрихкоду или названию
   */
  @Get('products/search')
  async searchProducts(
    @Param('warehouseId') warehouseId: string,
    @Query('query') query: string
  ) {
    return this.cashierService.searchProducts(warehouseId, query);
  }

  /**
   * Получение информации о текущей смене
   */
  @Get('shift/current')
  async getCurrentShift(@Param('warehouseId') warehouseId: string, @Req() req) {
    return this.cashierService.getCurrentShift(warehouseId, req.user.id);
  }

  /**
   * Создание нового чека
   */
  @Post('receipts')
  async createReceipt(
    @Param('warehouseId') warehouseId: string,
    @Req() req,
    @Body() createReceiptDto: any
  ) {
    return this.cashierService.createReceipt(
      warehouseId,
      req.user.id,
      createReceiptDto
    );
  }

  /**
   * Открытие кассовой смены
   */
  @Post('shift/open')
  async openShift(
    @Param('warehouseId') warehouseId: string,
    @Req() req,
    @Body() openShiftDto: any
  ) {
    return this.cashierService.openShift(
      warehouseId,
      req.user.id,
      openShiftDto
    );
  }

  /**
   * Закрытие кассовой смены
   */
  @Post('shift/close')
  async closeShift(
    @Param('warehouseId') warehouseId: string,
    @Req() req,
    @Body() closeShiftDto: any
  ) {
    return this.cashierService.closeShift(
      warehouseId,
      req.user.id,
      closeShiftDto
    );
  }
}
