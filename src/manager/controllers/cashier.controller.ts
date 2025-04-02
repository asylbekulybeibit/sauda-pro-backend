import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashierService } from '../services/cashier.service';
import { CreateReturnWithoutReceiptDto } from '../dto/cashier/create-return-without-receipt.dto';

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
    console.log('[CashierController] getCurrentShift request:', {
      warehouseId,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });
    const result = await this.cashierService.getCurrentShift(
      warehouseId,
      req.user.id
    );

    console.log('[CashierController] getCurrentShift response:', {
      shiftId: result?.id,
      status: result?.status,
      startTime: result?.startTime,
      endTime: result?.endTime,
    });

    if (result) {
      return {
        ...result,
        displayStatus: result.status.toUpperCase(),
      };
    }

    return result;
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
   * Добавление товара в чек
   */
  @Post('receipts/:receiptId/items')
  async addItemToReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Body() addItemDto: any,
    @Req() req
  ) {
    return this.cashierService.addItemToReceipt(
      warehouseId,
      receiptId,
      req.user.id,
      addItemDto
    );
  }

  /**
   * Удаление товара из чека
   */
  @Delete('receipts/:receiptId/items/:itemId')
  async removeItemFromReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Param('itemId') itemId: string,
    @Req() req
  ) {
    return this.cashierService.removeItemFromReceipt(
      warehouseId,
      receiptId,
      itemId,
      req.user.id
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

  /**
   * Получение списка отложенных чеков
   */
  @Get('receipts/postponed')
  async getPostponedReceipts(
    @Param('warehouseId') warehouseId: string,
    @Req() req
  ) {
    return this.cashierService.getPostponedReceipts(warehouseId);
  }

  /**
   * Отложить чек
   */
  @Post('receipts/:receiptId/postpone')
  async postponeReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Req() req
  ) {
    return this.cashierService.postponeReceipt(
      warehouseId,
      receiptId,
      req.user.id
    );
  }

  /**
   * Восстановить отложенный чек
   */
  @Post('receipts/:receiptId/restore')
  async restorePostponedReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Req() req
  ) {
    return this.cashierService.restorePostponedReceipt(
      warehouseId,
      receiptId,
      req.user.id
    );
  }

  /**
   * Удаление пустого чека
   */
  @Delete('receipts/:receiptId')
  async deleteReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Req() req
  ) {
    return this.cashierService.deleteReceipt(
      warehouseId,
      receiptId,
      req.user.id
    );
  }

  /**
   * Оплата чека
   */
  @Post('receipts/:receiptId/pay')
  async payReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Body() paymentData: { paymentMethodId: string; amount: number },
    @Req() req
  ) {
    return this.cashierService.payReceipt(
      warehouseId,
      receiptId,
      paymentData,
      req.user.id
    );
  }

  /**
   * Получение текущего активного чека
   */
  @Get('receipts/current')
  async getCurrentReceipt(@Param('warehouseId') warehouseId: string) {
    return this.cashierService.getCurrentReceipt(warehouseId);
  }

  /**
   * Создание возврата по чеку
   */
  @Post('receipts/:receiptId/return')
  async createReturn(
    @Param('warehouseId') warehouseId: string,
    @Param('receiptId') receiptId: string,
    @Body()
    returnData: {
      items: Array<{ receiptItemId: string; quantity: number }>;
      reason: string;
    },
    @Req() req
  ) {
    return this.cashierService.createReturn(
      warehouseId,
      receiptId,
      returnData,
      req.user.id
    );
  }

  /**
   * Создание возврата без чека
   */
  @Post('returns/without-receipt')
  async createReturnWithoutReceipt(
    @Param('warehouseId') warehouseId: string,
    @Body() returnData: CreateReturnWithoutReceiptDto,
    @Req() req
  ) {
    return this.cashierService.createReturnWithoutReceipt(
      warehouseId,
      returnData,
      req.user.id
    );
  }

  /**
   * Поиск чеков по номеру
   */
  @Get('receipts/search')
  async searchReceipts(
    @Param('warehouseId') warehouseId: string,
    @Query('receiptNumber') receiptNumber: string
  ) {
    return this.cashierService.searchReceipts(warehouseId, receiptNumber);
  }
}
