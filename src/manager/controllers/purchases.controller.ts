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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { PurchasesService } from '../services/purchases.service';
import {
  CreatePurchaseDto,
  PurchasePaymentDto,
} from '../dto/purchases/create-purchase.dto';
import { PurchaseWithItems } from '../interfaces/purchase-with-items.interface';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentMethodTransactionsService } from '../services/payment-method-transactions.service';
import { DebtsService } from '../services/debts.service';
import { DebtType } from '../entities/debt.entity';
import { PurchaseStatus } from '../entities/purchase.entity';

@Controller('manager/purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly paymentMethodTransactionsService: PaymentMethodTransactionsService,
    private readonly debtsService: DebtsService
  ) {}

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

  @Post(':id/payments')
  @ApiOperation({ summary: 'Add payment to purchase' })
  @ApiResponse({ status: 200, description: 'Payment added successfully' })
  async addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payment: PurchasePaymentDto,
    @Request() req
  ): Promise<PurchaseWithItems> {
    // Получаем актуальные данные о приходе
    const purchase = await this.purchasesService.findOne(
      id,
      req.user.warehouseId
    );

    if (!purchase) {
      throw new NotFoundException('Приход не найден');
    }

    if (payment.amount <= 0) {
      throw new BadRequestException('Сумма оплаты должна быть больше 0');
    }

    if (payment.amount > purchase.remainingAmount) {
      throw new BadRequestException('Сумма оплаты превышает оставшуюся сумму');
    }

    // Создаем транзакцию оплаты
    await this.paymentMethodTransactionsService.recordPurchasePayment(
      payment.paymentMethodId,
      payment.amount,
      purchase.id,
      req.user.id,
      null,
      payment.note
    );

    // Обновляем информацию об оплате в приходе
    const newPaidAmount =
      Number(purchase.paidAmount || 0) + Number(payment.amount);
    const newRemainingAmount =
      Number(purchase.totalAmount || 0) - newPaidAmount;

    // Обновляем запись в базе данных
    await this.purchasesService.update(purchase.id, {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      status:
        newRemainingAmount === 0 ? PurchaseStatus.COMPLETED : purchase.status,
    });

    // Создаем или обновляем долг, если он есть
    if (purchase.supplierId) {
      const debtData = {
        warehouseId: purchase.warehouseId,
        type: DebtType.PAYABLE,
        supplierId: purchase.supplierId,
        totalAmount: purchase.totalAmount,
        paidAmount: newPaidAmount,
        purchaseId: purchase.id,
      };

      // Если долг уже существует, обновляем его
      const existingDebt = await this.debtsService.findByPurchaseId(
        purchase.id
      );
      if (existingDebt) {
        await this.debtsService.update(existingDebt.id, debtData);
      }
    }

    // Возвращаем обновленные данные
    return this.purchasesService.findOne(purchase.id, purchase.warehouseId);
  }

  @Get(':warehouseId/:id/payments')
  @ApiOperation({ summary: 'Get purchase payment history' })
  @ApiResponse({ status: 200, description: 'Returns payment history' })
  async getPaymentHistory(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    // Проверяем существование прихода
    const purchase = await this.purchasesService.findOne(id, warehouseId);
    if (!purchase) {
      throw new NotFoundException('Приход не найден');
    }
    return this.paymentMethodTransactionsService.findAllByPurchase(id);
  }
}
