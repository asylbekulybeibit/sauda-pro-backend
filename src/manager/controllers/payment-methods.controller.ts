import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { PaymentMethodTransactionsService } from '../services/payment-method-transactions.service';
import { TransactionType } from '../entities/payment-method-transaction.entity';

@Controller('manager/:warehouseId/payment-methods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class PaymentMethodsController {
  constructor(
    private readonly transactionsService: PaymentMethodTransactionsService
  ) {}

  @Get(':id/transactions')
  async getTransactions(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    let startDateObj, endDateObj;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        throw new BadRequestException('Неверный формат начальной даты');
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        throw new BadRequestException('Неверный формат конечной даты');
      }
    }

    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;

    return this.transactionsService.findAllByPaymentMethod(
      id,
      startDateObj,
      endDateObj,
      type as TransactionType,
      parsedLimit,
      parsedOffset
    );
  }

  @Post(':id/deposit')
  async deposit(
    @Param('id') id: string,
    @Body() depositData: { amount: number; note?: string; shiftId?: string },
    @Request() req
  ) {
    return this.transactionsService.deposit(
      id,
      depositData.amount,
      depositData.note,
      req.user.id,
      depositData.shiftId
    );
  }

  @Post(':id/withdraw')
  async withdraw(
    @Param('id') id: string,
    @Body() withdrawData: { amount: number; note?: string; shiftId?: string },
    @Request() req
  ) {
    return this.transactionsService.withdraw(
      id,
      withdrawData.amount,
      withdrawData.note,
      req.user.id,
      withdrawData.shiftId
    );
  }
}
